import type { Job } from "bullmq";
import { pgPool } from "../db/pool";
import { env } from "../config/env";
import type { DocumentRow } from "../types/dtos";
import type {
  AnalysisJobData,
  ExtractionCompletedPayload,
  CleaningCompletedPayload,
  StructuringCompletedPayload,
  ChunkingCompletedPayload,
  EmbeddingCompletedPayload,
  SummarizingCompletedPayload,
} from "../types/dtos";
import type { AnalysisState } from "./stages/types";
import { reportFailure } from "./stageReporter";
import { supabase } from "../lib/supabase";
import { estimateQuality } from "../services/ingestion/estimateQuality";

import { processInitializationStage } from "./stages/initializationStage";
import { processCleaningStage } from "./stages/cleaningStage";
import { processStructuringStage } from "./stages/structuringStage";
import { processChunkingStage } from "./stages/chunkingStage";
import { processEmbeddingStage } from "./stages/embeddingStage";
import { processSummarizingStage } from "./stages/summarizingStage";
import { processCompletionStage } from "./stages/completionStage";

const TERMINAL_OR_PAST: ReadonlySet<string> = new Set([
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "PREPROCESSING_COMPLETED",
  "AI_QUEUED",
  "AI_PROCESSING",
  "AI_COMPLETED",
]);

async function loadDoc(documentId: string): Promise<DocumentRow | null> {
  const res = await pgPool.query<DocumentRow>(
    `SELECT * FROM documents WHERE id = $1`,
    [documentId],
  );
  return res.rowCount === 0 ? null : res.rows[0];
}

async function writeOutboxEvent(
  eventType: string,
  analysisRequestId: string,
  payload: object,
): Promise<void> {
  await pgPool.query(
    `INSERT INTO public.document_pipeline_outbox
       (event_type, aggregate_type, aggregate_id, payload, status)
     VALUES ($1, 'document_analysis_request', $2, $3::jsonb, 'pending')`,
    [eventType, analysisRequestId, JSON.stringify(payload)],
  );
}

async function runStage<
  TData extends { documentId: string; analysisRequestId: string; userId: string },
>(
  job: Job<TData>,
  work: (doc: DocumentRow, workerId: string) => Promise<void>,
): Promise<void> {
  const { documentId, analysisRequestId, userId } = job.data;
  const doc = await loadDoc(documentId);
  if (!doc) return;
  if (TERMINAL_OR_PAST.has(doc.analysis_status)) return;

  const workerId = env.WORKER_ID;
  try {
    await work(doc, workerId);
  } catch (err) {
    await reportFailure({ documentId, analysisRequestId, userId, workerId, error: err });
    throw err;
  }
}

export async function handleStageInitialization(job: Job<AnalysisJobData>): Promise<void> {
  const { documentId, analysisRequestId, userId, storagePath, mimeType, analysisVersion } =
    job.data;

  await runStage(job, async (doc, workerId) => {
    await pgPool.query(
      `UPDATE document_analysis_requests
         SET status = 'PROCESSING', worker_id = $1, started_at = COALESCE(started_at, now())
       WHERE id = $2`,
      [workerId, analysisRequestId],
    );

    let state: AnalysisState = {
      job: job as unknown as Job<AnalysisJobData>,
      doc,
      workerId,
      currentStatus: doc.analysis_status,
    };
    state = await processInitializationStage(state);

    await writeOutboxEvent("document.initialized", analysisRequestId, {
      documentId,
      analysisRequestId,
      userId,
      storagePath,
      mimeType,
      analysisVersion,
    });
  });
}

/* Stage 2 (extraction) runs in the Python ocr-engine service, which
 * writes the 'document.extracted' outbox event itself. No Node handler. */

export async function handleStageCleaning(job: Job<ExtractionCompletedPayload>): Promise<void> {
  const {
    documentId,
    analysisRequestId,
    userId,
    storagePath,
    mimeType,
    analysisVersion,
    markdownStoragePath,
    ocrConfidence,
    textCoverage,
  } = job.data;

  await runStage(job, async (doc, workerId) => {
    const { data, error } = await supabase.storage
      .from("parsed-documents")
      .download(markdownStoragePath);
    if (error || !data) {
      throw new Error(
        `Failed to download parsed markdown ${markdownStoragePath}: ${error?.message}`,
      );
    }
    const rawText = Buffer.from(await data.arrayBuffer()).toString("utf-8");

    let state: AnalysisState = {
      job: job as unknown as Job<AnalysisJobData>,
      doc,
      workerId,
      currentStatus: doc.analysis_status,
      rawText,
      ocrConfidence,
      textCoverage,
    };
    state = await processCleaningStage(state);

    const quality = estimateQuality({ ocrConfidence, textCoverage });

    await writeOutboxEvent("document.cleaned", analysisRequestId, {
      documentId,
      analysisRequestId,
      userId,
      storagePath,
      mimeType,
      analysisVersion,
      cleanText: state.cleanText ?? "",
      quality,
    });
  });
}

export async function handleStageStructuring(job: Job<CleaningCompletedPayload>): Promise<void> {
  const {
    documentId,
    analysisRequestId,
    userId,
    storagePath,
    mimeType,
    analysisVersion,
    cleanText,
    quality,
  } = job.data;

  await runStage(job, async (doc, workerId) => {
    let state: AnalysisState = {
      job: job as unknown as Job<AnalysisJobData>,
      doc,
      workerId,
      currentStatus: doc.analysis_status,
      cleanText,
      quality: quality as AnalysisState["quality"],
    };
    state = await processStructuringStage(state);

    await writeOutboxEvent("document.structured", analysisRequestId, {
      documentId,
      analysisRequestId,
      userId,
      storagePath,
      mimeType,
      analysisVersion,
      cleanText,
      sections: state.sections ?? [],
      facts: state.facts ?? [],
    });
  });
}

export async function handleStageChunking(job: Job<StructuringCompletedPayload>): Promise<void> {
  const { documentId, analysisRequestId, userId, storagePath, mimeType, analysisVersion, sections, facts } =
    job.data;

  await runStage(job, async (doc, workerId) => {
    let state: AnalysisState = {
      job: job as unknown as Job<AnalysisJobData>,
      doc,
      workerId,
      currentStatus: doc.analysis_status,
      sections: sections as AnalysisState["sections"],
      facts: facts as AnalysisState["facts"],
    };
    state = await processChunkingStage(state);

    await writeOutboxEvent("document.chunked", analysisRequestId, {
      documentId,
      analysisRequestId,
      userId,
      storagePath,
      mimeType,
      analysisVersion,
    });
  });
}

export async function handleStageEmbedding(job: Job<ChunkingCompletedPayload>): Promise<void> {
  const { documentId, analysisRequestId, userId, storagePath, mimeType, analysisVersion } =
    job.data;

  await runStage(job, async (doc, workerId) => {
    let state: AnalysisState = {
      job: job as unknown as Job<AnalysisJobData>,
      doc,
      workerId,
      currentStatus: doc.analysis_status,
    };
    state = await processEmbeddingStage(state);

    await writeOutboxEvent("document.embedded", analysisRequestId, {
      documentId,
      analysisRequestId,
      userId,
      storagePath,
      mimeType,
      analysisVersion,
    });
  });
}

export async function handleStageSummarizing(job: Job<EmbeddingCompletedPayload>): Promise<void> {
  const { documentId, analysisRequestId, userId, storagePath, mimeType, analysisVersion } =
    job.data;

  await runStage(job, async (doc, workerId) => {
    let state: AnalysisState = {
      job: job as unknown as Job<AnalysisJobData>,
      doc,
      workerId,
      currentStatus: doc.analysis_status,
    };
    state = await processSummarizingStage(state);

    await writeOutboxEvent("document.summarized", analysisRequestId, {
      documentId,
      analysisRequestId,
      userId,
      storagePath,
      mimeType,
      analysisVersion,
      title: state.title,
      summary: state.summary,
    });
  });
}

/* processCompletionStage already writes the terminal
 * 'document.preprocessing.completed' outbox event itself, which the
 * dispatcher already routes to the AI-analysis job - unchanged. */
export async function handleStageCompletion(job: Job<SummarizingCompletedPayload>): Promise<void> {
  await runStage(job, async (doc, workerId) => {
    const state: AnalysisState = {
      job: job as unknown as Job<AnalysisJobData>,
      doc,
      workerId,
      currentStatus: doc.analysis_status,
      title: job.data.title,
      summary: job.data.summary,
    };
    await processCompletionStage(state);
  });
}
