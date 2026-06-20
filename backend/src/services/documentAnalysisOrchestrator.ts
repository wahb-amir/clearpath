import { pgPool, withTransaction } from "../db/pool";
import { getGroqModel } from "../lib/llm/groqClient";
import type {
  DocumentAnalysisJobData,
  NormalizedDocument,
} from "../types/documentAnalysis";
import {
  failAnalysisResult,
  finalizeAnalysisResult,
  getOrCreatePendingAnalysisResult,
  loadAnalysisResultByRequestId,
} from "./documentAnalysisResultRepository";
import { runClearPathPipeline } from "./documentAnalysisPipeline";
import { insertPipelineEvent } from "./analysisRequestService";
import {
  createPublisherConnection,
  channelForDocument,
} from "../redis/connection";

interface DocumentSectionRow {
  id: string;
  document_id: string;
  parent_section_id: string | null;
  order_index: number;
  title: string | null;
  text_content: string | null;
}

interface DocumentFactRow {
  fact_type: string;
  value: string;
  normalized_value: string | null;
}

interface DocumentRow {
  id: string;
  user_id: string;
  language: string | null;
  mime_type: string;
}

function buildSourceTextFromRows(
  sections: DocumentSectionRow[],
  facts: DocumentFactRow[],
): string {
  const sectionsText = sections
    .sort((a, b) => a.order_index - b.order_index)
    .map((section) =>
      [section.title, section.text_content].filter(Boolean).join("\n"),
    )
    .filter(Boolean);

  const factsText = facts.map(
    (fact) => `${fact.fact_type}: ${fact.normalized_value ?? fact.value}`,
  );
  return [...sectionsText, ...factsText].join("\n\n").trim();
}

export async function loadNormalizedDocument(
  documentId: string,
): Promise<NormalizedDocument> {
  const docResult = await pgPool.query<DocumentRow>(
    `SELECT id, user_id, language, mime_type
       FROM documents
      WHERE id = $1
      LIMIT 1`,
    [documentId],
  );

  if (docResult.rowCount === 0) {
    throw new Error(`Document ${documentId} was not found.`);
  }

  const doc = docResult.rows[0];

  const sectionsResult = await pgPool.query<DocumentSectionRow>(
    `SELECT id, document_id, parent_section_id, order_index, title, text_content
       FROM document_sections
      WHERE document_id = $1
      ORDER BY order_index ASC`,
    [documentId],
  );

  const factsResult = await pgPool.query<DocumentFactRow>(
    `SELECT fact_type, value, normalized_value
       FROM document_facts
      WHERE document_id = $1`,
    [documentId],
  );

  const sourceText = buildSourceTextFromRows(
    sectionsResult.rows,
    factsResult.rows,
  );

  return {
    document_id: doc.id,
    user_id: doc.user_id,
    file_type: doc.mime_type,
    language: doc.language,
    source_text: sourceText || " ",
    sections: sectionsResult.rows.map((section) => ({
      section_id: section.id,
      title: section.title,
      content: section.text_content ?? "",
      parent_id: section.parent_section_id,
      order: section.order_index,
    })),
    entities: {
      dates: factsResult.rows
        .filter(
          (fact) => fact.fact_type === "date" || fact.fact_type === "deadline",
        )
        .map((fact) => fact.normalized_value ?? fact.value),
      contacts: factsResult.rows
        .filter(
          (fact) => fact.fact_type === "email" || fact.fact_type === "phone",
        )
        .map((fact) => fact.normalized_value ?? fact.value),
      urls: factsResult.rows
        .filter(
          (fact) => fact.fact_type === "url" || fact.fact_type === "website",
        )
        .map((fact) => fact.normalized_value ?? fact.value),
      names: factsResult.rows
        .filter(
          (fact) =>
            fact.fact_type === "name" || fact.fact_type === "organization",
        )
        .map((fact) => fact.normalized_value ?? fact.value),
    },
  };
}

/** Publish a pipeline event to Postgres + Redis so SSE clients get it immediately. */
async function emitAiEvent(params: {
  documentId: string;
  userId: string;
  eventType: string;
  stage: string;
  message: string;
  progress?: number;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const client = await pgPool.connect();
  let eventId: number | undefined;
  try {
    const event = await insertPipelineEvent(client, {
      documentId: params.documentId,
      userId: params.userId,
      eventType: params.eventType as any,
      stage: params.stage as any,
      message: params.message,
      progress: params.progress ?? null,
      payload: params.payload ?? null,
    });
    eventId = event.id;
  } finally {
    client.release();
  }

  // Best-effort Redis push so SSE subscribers get it live
  try {
    const pub = createPublisherConnection();
    await pub.publish(
      channelForDocument(params.documentId),
      JSON.stringify({ documentId: params.documentId, eventId }),
    );
    pub.disconnect();
  } catch {
    // non-fatal
  }
}

export async function runAndPersistDocumentAnalysis(
  jobData: DocumentAnalysisJobData,
) {
  const model = getGroqModel();

  const existing = await loadAnalysisResultByRequestId(
    jobData.analysisRequestId,
  );
  if (
    existing?.status === "completed" ||
    existing?.status === "review_required"
  ) {
    return existing;
  }

  await pgPool.query(
    `UPDATE document_analysis_requests
        SET status = 'PROCESSING',
            worker_id = COALESCE(worker_id, $2),
            started_at = COALESCE(started_at, now())
      WHERE id = $1`,
    [jobData.analysisRequestId, process.env.WORKER_ID ?? "clearpath-ai-worker"],
  );

  await withTransaction(async (client) => {
    await getOrCreatePendingAnalysisResult(
      client,
      jobData.analysisRequestId,
      jobData.documentId,
      jobData.userId,
      model,
    );
  });

  const document = await loadNormalizedDocument(jobData.documentId);

  // SSE emit callback — wires the pipeline's internal progress ticks to the
  // Postgres event log + Redis pub/sub so the frontend gets live updates.
  const emit = async (input: {
    documentId: string;
    userId: string;
    eventType: string;
    stage: string;
    message: string;
    progress?: number;
    payload?: Record<string, unknown>;
  }) => {
    await emitAiEvent(input);
  };

  try {
    const result = await runClearPathPipeline(
      document,
      { maxSearchResultsPerQuery: 5 },
      emit,
    );

    await withTransaction(async (client) => {
      await finalizeAnalysisResult(client, {
        analysisRequestId: jobData.analysisRequestId,
        documentId: jobData.documentId,
        userId: jobData.userId,
        model,
        result,
      });
    });

    await pgPool.query(
      `UPDATE document_analysis_requests
          SET status = 'COMPLETED',
              finished_at = now()
        WHERE id = $1`,
      [jobData.analysisRequestId],
    );

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown analysis failure";

    await withTransaction(async (client) => {
      await failAnalysisResult(
        client,
        jobData.analysisRequestId,
        jobData.documentId,
        jobData.userId,
        model,
        message,
      );
    });

    await pgPool.query(
      `UPDATE document_analysis_requests
          SET status = 'FAILED',
              error_message = $2,
              finished_at = now()
        WHERE id = $1`,
      [jobData.analysisRequestId, message],
    );

    throw error;
  }
}
