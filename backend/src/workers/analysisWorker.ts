import { ConnectionOptions, Worker, type Job } from "bullmq";
import { createWorkerConnection } from "../redis/connection";
import { env } from "../config/env";
import { pgPool } from "../db/pool";
import type { AnalysisJobData, DocumentRow } from "../types/dtos";
import type { AnalysisStatus } from "../types/pipelineStatus";
import { reportFailure } from "./stageReporter";

import type { AnalysisState } from "./stages/types";
import { processInitializationStage } from "./stages/initializationStage";
import { processExtractionStage } from "./stages/extractionStage";
import { processCleaningStage } from "./stages/cleaningStage";
import { processAwaitingVerificationStage } from "./stages/awaitingVerificationStage";
import { processStructuringStage } from "./stages/structuringStage";
import { processChunkingStage } from "./stages/chunkingStage";
import { processEmbeddingStage } from "./stages/embeddingStage";
import { processSummarizingStage } from "./stages/summarizingStage";
import { processCompletionStage } from "./stages/completionStage";

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
  const { documentId, analysisRequestId, userId } = job.data;
  console.log("[analysis-worker] START", job.id, documentId);
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

  let state: AnalysisState = {
    job,
    doc,
    workerId,
    currentStatus: doc.analysis_status as AnalysisStatus,
  };

  try {
    state = await processInitializationStage(state);
    state = await processExtractionStage(state);
    state = await processCleaningStage(state);

    const verificationResult = await processAwaitingVerificationStage(state);
    if (verificationResult.halt) {
      return;
    }
    state = verificationResult.state;

    state = await processStructuringStage(state);
    state = await processChunkingStage(state);
    state = await processEmbeddingStage(state);
    state = await processSummarizingStage(state);
    await processCompletionStage(state);
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
