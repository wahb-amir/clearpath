import type { Job } from "bullmq";
import { pgPool } from "../db/pool";
import { env } from "../config/env";
import type { DocumentRow } from "../types/dtos";
import type {
  AnalysisJobData,
  ExtractionCompletedPayload,
} from "../types/dtos";
import type { AnalysisState } from "./stages/types";
import { isStageCompleteOrPast } from "../types/pipelineStatus";
import { reportFailure } from "./stageReporter";
import { supabase } from "../lib/supabase";
import { estimateQuality } from "../services/ingestion/estimateQuality";

import { processInitializationStage } from "./stages/initializationStage";
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

export async function handleNodePipeline(job: Job<ExtractionCompletedPayload>): Promise<void> {
  const {
    documentId,
    analysisRequestId,
    userId,
    markdownStoragePath,
    ocrConfidence,
    textCoverage,
  } = job.data;

  await runStage(job, async (doc, workerId) => {
    let state: AnalysisState = {
      job: job as unknown as Job<AnalysisJobData>,
      doc,
      workerId,
      currentStatus: doc.analysis_status,
      ocrConfidence,
      textCoverage,
    };

    if (!isStageCompleteOrPast(state.currentStatus, "EXTRACTING")) {
      const { data, error } = await supabase.storage
        .from("parsed-documents")
        .download(markdownStoragePath);
      
      if (error || !data) {
        throw new Error(
          `Failed to download parsed markdown ${markdownStoragePath}: ${error?.message}`
        );
      }
      
      state.markdownContent = Buffer.from(await data.arrayBuffer()).toString("utf-8");

      // Set to CLEANING for backward compatibility with in-flight documents, but we jump straight to STRUCTURING next.
      await pgPool.query(`UPDATE documents SET analysis_status = 'CLEANING' WHERE id = $1`, [documentId]);
      state.currentStatus = "CLEANING";
    }

    state = await processStructuringStage(state);
    state = await processChunkingStage(state);
    state = await processEmbeddingStage(state);
    state = await processSummarizingStage(state);
    
    // The completion stage already writes the terminal outbox event itself
    await processCompletionStage(state);
  });
}

