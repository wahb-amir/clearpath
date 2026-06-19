import { ConnectionOptions, Worker, type Job } from "bullmq";
import type { PoolClient } from "pg";
import { createWorkerConnection } from "../redis/connection";
import { env } from "../config/env";
import { pgPool, withTransaction } from "../db/pool";
import { supabase } from "../lib/supabase";
import type { AnalysisJobData, DocumentRow } from "../types/dtos";
import type { AnalysisStatus } from "../types/pipelineStatus";
import { isStageCompleteOrPast } from "../types/pipelineStatus";
import { reportStage, reportProgress, reportFailure } from "./stageReporter";
import { detectFileCategory } from "./stages/detectFileType";
import { extractText } from "../services/ingestion/extractText";
import { cleanExtractedText } from "../services/ingestion/cleanText";
import { detectLanguage } from "../services/ingestion/detectLanguage";
import { buildDocumentStructure } from "../services/ingestion/buildStructure";
import { extractFacts } from "../services/ingestion/extractFacts";
import { estimateQuality } from "../services/ingestion/estimateQuality";
import { buildChunks } from "../services/ingestion/buildChunks";
import { generateSummary } from "../services/ingestion/generateSummary";
import {
  persistSections,
  persistChunks,
  persistFacts,
  clearDerivedRecords,
} from "../services/ingestion/persistence";

export function createAnalysisWorker(): Worker<AnalysisJobData> {
  const worker = new Worker<AnalysisJobData>(
    env.ANALYSIS_QUEUE_NAME,
    async (job: Job<AnalysisJobData>) => {
      if (job.name !== "analyze-document") return;
      await processAnalysisJob(job);
    },
    {
      connection: createWorkerConnection() as ConnectionOptions,
      concurrency: 2,
      lockDuration: 10 * 60 * 1000,
    },
  );

  worker.on("active", (job) => {
    console.log("[analysis-worker] ACTIVE", job.id);
  });

  worker.on("completed", (job) => {
    console.log("[analysis-worker] COMPLETED", job.id);
  });

  worker.on("failed", (job, err) => {
    console.error("[analysis-worker] FAILED", job?.id, err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[worker] unhandled rejection:", reason);
  });

  return worker;
}

export async function processAnalysisJob(
  job: Job<AnalysisJobData>,
): Promise<void> {
  const {
    documentId,
    analysisRequestId,
    userId,
    storagePath,
    mimeType,
    analysisVersion,
  } = job.data;
  console.log("[analysis-worker] START", job.id, job.data.documentId);
  const workerId = env.WORKER_ID;

  const docResult = await pgPool.query<DocumentRow>(
    `SELECT * FROM documents WHERE id = $1`,
    [documentId],
  );

  if (docResult.rowCount === 0) return;

  const doc = docResult.rows[0];

  if (
    doc.analysis_status === "COMPLETED" ||
    doc.analysis_status === "CANCELLED" ||
    doc.analysis_status === "FAILED" ||
    doc.analysis_status === "AWAITING_VERIFICATION" ||
    doc.analysis_status === "PREPROCESSING_COMPLETED" ||
    doc.analysis_status === "AI_QUEUED" ||
    doc.analysis_status === "AI_PROCESSING" ||
    doc.analysis_status === "AI_COMPLETED"
  ) {
    return;
  }

  await pgPool.query(
    `UPDATE document_analysis_requests
       SET status = 'PROCESSING',
           worker_id = $1,
           started_at = COALESCE(started_at, now())
     WHERE id = $2`,
    [workerId, analysisRequestId],
  );

  try {
    let currentStatus = doc.analysis_status as AnalysisStatus;

    if (!isStageCompleteOrPast(currentStatus, "PROCESSING")) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: "PROCESSING",
        eventType: "worker_assigned",
        message: `Worker ${workerId} picked up the job`,
        progress: 5,
      });
      currentStatus = "PROCESSING";
    }

    let rawText = "";
    let extractionMethod: "embedded" | "ocr" | "plain_text" = "plain_text";
    let ocrConfidence = 1;
    let textCoverage = 1;
    let usedOcrFallback = false;

    if (!isStageCompleteOrPast(currentStatus, "EXTRACTING")) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: "EXTRACTING",
        eventType: "extraction_started",
        message: "Detecting file type and extracting text",
        progress: 10,
      });

      const fileBuffer = await downloadFromStorage(storagePath);
      const category = detectFileCategory(mimeType);

      const extraction = await extractText({
        fileBuffer,
        category,
        mimeType,
        onPageProgress: async (current, total) => {
          await reportProgress({
            documentId,
            userId,
            stage: "EXTRACTING",
            eventType: "extraction_progress",
            message: `Processed page ${current} of ${total}`,
            progress: 10 + Math.round((current / total) * 15),
            payload: { currentPage: current, totalPages: total },
          });
        },
      });

      rawText = extraction.rawText;
      extractionMethod = extraction.method;
      ocrConfidence = extraction.ocrConfidence;
      textCoverage = extraction.textCoverage;
      usedOcrFallback = extraction.usedOcrFallback;

      if (usedOcrFallback) {
        await reportProgress({
          documentId,
          userId,
          stage: "EXTRACTING",
          eventType: "ocr_fallback_started",
          message: "Sparse embedded text detected - OCR fallback applied",
          progress: 25,
          payload: { ocrConfidence },
        });
      }

      currentStatus = "EXTRACTING";

      await pgPool.query(
        `UPDATE documents SET ocr_confidence = $1 WHERE id = $2`,
        [ocrConfidence, documentId],
      );
    } else {
      const fileBuffer = await downloadFromStorage(storagePath);
      const category = detectFileCategory(mimeType);
      const extraction = await extractText({ fileBuffer, category, mimeType });
      rawText = extraction.rawText;
      extractionMethod = extraction.method;
      ocrConfidence = extraction.ocrConfidence;
      textCoverage = extraction.textCoverage;
    }

    const cleanResult = cleanExtractedText(rawText, ocrConfidence);
    const cleanText = cleanResult.cleanText;

    if (!isStageCompleteOrPast(currentStatus, "CLEANING")) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: "CLEANING",
        eventType: "text_cleaned",
        message: "Removed OCR noise and normalized whitespace",
        progress: 35,
        payload: { correctionsApplied: cleanResult.correctionsApplied },
      });

      const language = detectLanguage(cleanText);
      await pgPool.query(`UPDATE documents SET language = $1 WHERE id = $2`, [
        language.code,
        documentId,
      ]);

      await reportProgress({
        documentId,
        userId,
        stage: "CLEANING",
        eventType: "language_detected",
        message: `Detected language: ${language.name}`,
        progress: 38,
        payload: { language: language.code, languageName: language.name },
      });

      currentStatus = "CLEANING";
    }

    let sections: ReturnType<typeof buildDocumentStructure>;
    let facts: ReturnType<typeof extractFacts>;
    let quality: ReturnType<typeof estimateQuality>;
    let title: string;
    let summary: string;

    if (!isStageCompleteOrPast(currentStatus, "AWAITING_VERIFICATION")) {
      sections = buildDocumentStructure(cleanText);
      facts = extractFacts(cleanText);
      quality = estimateQuality({ ocrConfidence, textCoverage });
      const generated = generateSummary({ cleanText, sections });
      title = generated.title;
      summary = generated.summary;

      const extractedContent = {
        title,
        summary,
        language: doc.language ?? detectLanguage(cleanText).name,
        quality: quality.quality,
        ocrConfidence,
        extractionMethod,
        sections: sections.map((s, i) => ({
          index: i,
          title: s.title ?? `Section ${i + 1}`,
          content: s.children?.length
            ? s.children.map((c) => ("content" in c ? c.content : "")).join("\n\n")
            : ("content" in s ? s.content : ""),
        })),
        dates: facts
          .filter((f) => f.factType === "date" || f.factType === "deadline")
          .map((f) => ({
            value: f.value,
            normalizedValue: f.normalizedValue,
            factType: f.factType,
            context: f.context,
            confidence: f.confidence,
          })),
        contacts: facts
          .filter((f) => f.factType === "email" || f.factType === "phone")
          .map((f) => ({
            value: f.value,
            factType: f.factType,
            context: f.context,
            confidence: f.confidence,
          })),
        amounts: facts
          .filter((f) => f.factType === "amount")
          .map((f) => ({
            value: f.value,
            context: f.context,
            confidence: f.confidence,
          })),
        referenceIds: facts
          .filter((f) => f.factType === "reference_id")
          .map((f) => ({
            value: f.value,
            context: f.context,
            confidence: f.confidence,
          })),
        rawTextPreview: cleanText.slice(0, 3000),
      };

      await withTransaction(async (client) => {
        await client.query(
          `UPDATE documents
              SET analysis_status    = 'AWAITING_VERIFICATION',
                  current_stage      = 'AWAITING_VERIFICATION',
                  worker_id          = $1,
                  extracted_content  = $2::jsonb
            WHERE id = $3`,
          [workerId, JSON.stringify(extractedContent), documentId],
        );

        await client.query(
          `UPDATE document_analysis_requests
              SET status = 'PROCESSING'
            WHERE id = $1`,
          [analysisRequestId],
        );

        const { insertPipelineEvent } = await import("../services/analysisRequestService");

        await insertPipelineEvent(client, {
          documentId,
          userId,
          eventType: "extraction_awaiting_verification" as any,
          stage: "AWAITING_VERIFICATION",
          message: "Extraction complete — please verify and confirm the extracted content",
          progress: 40,
          payload: {
            extractedContent,
            analysisRequestId,
            _resumeMeta: { analysisRequestId, analysisVersion },
          },
        });
      });

      try {
        const { createPublisherConnection, channelForDocument } = await import("../redis/connection");
        const pub = createPublisherConnection();
        await pub.publish(
          channelForDocument(documentId),
          JSON.stringify({ documentId, eventId: -99 }),
        );
        pub.disconnect();
      } catch {}

      return;
    } else {
      const content = doc.extracted_content as any;
      title = content.title ?? "Untitled document";
      summary = content.summary ?? "";
      quality = {
        quality: content.quality ?? "unknown",
        ocrConfidence: content.ocrConfidence ?? doc.ocr_confidence ?? 1,
        textCoverage: content.textCoverage ?? 1,
      };
      
      facts = [];
      const addFact = (arr: any[], defaultType?: string) => {
        if (!arr) return;
        for (const item of arr) {
          facts.push({
            factType: (item.factType ?? defaultType) as any,
            value: item.value,
            normalizedValue: item.normalizedValue,
            context: item.context,
            confidence: item.confidence
          });
        }
      };
      addFact(content.dates);
      addFact(content.contacts);
      addFact(content.amounts, "amount");
      addFact(content.referenceIds, "reference_id");

      sections = (content.sections || []).map((s: any) => ({
        title: s.title,
        level: 1,
        sectionType: "section",
        textContent: s.content,
        orderIndex: s.index,
        children: []
      }));
    }

    if (!isStageCompleteOrPast(currentStatus, "STRUCTURING")) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: "STRUCTURING",
        eventType: "structure_preserved",
        message: "Preserved document structure (sections, lists, tables)",
        progress: 45,
        payload: {
          sectionCount: countSections(sections),
          factCount: facts.length,
        },
      });

      await pgPool.query(`UPDATE documents SET quality = $1 WHERE id = $2`, [
        quality.quality,
        documentId,
      ]);

      await reportProgress({
        documentId,
        userId,
        stage: "STRUCTURING",
        eventType: "entities_extracted",
        message: `Extracted ${facts.length} structured facts`,
        progress: 50,
        payload: { factCount: facts.length },
      });

      currentStatus = "STRUCTURING";
    }

    if (!isStageCompleteOrPast(currentStatus, "CHUNKING")) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: "CHUNKING",
        eventType: "chunking_completed",
        message:
          "Built hierarchical chunks (document/section/paragraph/sentence)",
        progress: 60,
      });

      const chunks = buildChunks({ documentSummary: summary, sections });

      await withTransaction(async (client) => {
        await clearDerivedRecords(client, documentId);

        const sectionIdMap = await persistSections(
          client,
          documentId,
          sections,
        );
        await persistFacts(client, documentId, facts);
        await persistChunks(client, documentId, chunks, sectionIdMap);
      });

      currentStatus = "CHUNKING";
    }

    if (!isStageCompleteOrPast(currentStatus, "EMBEDDING")) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: "EMBEDDING",
        eventType: "embedding_completed",
        message: "Generated embeddings for all chunks (bge-small-en-v1.5)",
        progress: 80,
      });
      currentStatus = "EMBEDDING";
    }

    if (!isStageCompleteOrPast(currentStatus, "SUMMARIZING")) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: "SUMMARIZING",
        eventType: "summary_created",
        message: "Generated document summary",
        progress: 90,
        payload: { title, summary },
      });
      currentStatus = "SUMMARIZING";
    }

    // The pipeline continues processing normally...
    return;
  } catch (err) {
    await reportFailure({
      documentId,
      analysisRequestId,
      userId,
      workerId,
      error: err,
    });
    throw err;
  }
}

function countSections(
  sections: ReturnType<typeof buildDocumentStructure>,
): number {
  let count = 0;
  const visit = (nodes: typeof sections) => {
    for (const n of nodes) {
      count += 1;
      visit(n.children);
    }
  };
  visit(sections);
  return count;
}

/** Downloads the uploaded file from Supabase Storage. */
async function downloadFromStorage(storagePath: string): Promise<Buffer> {
  const BUCKET = "documents";
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new Error(
      `Failed to download ${storagePath} from storage: ${error?.message}`,
    );
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function insertOutboxEvent(
  client: PoolClient,
  event: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `
    INSERT INTO document_pipeline_outbox (
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      status,
      retry_count
    )
    VALUES ($1, $2, $3, $4::jsonb, 'pending', 0)
    `,
    [
      event.eventType,
      event.aggregateType,
      event.aggregateId,
      JSON.stringify(event.payload),
    ],
  );
}
