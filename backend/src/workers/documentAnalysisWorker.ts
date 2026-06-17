import { type ConnectionOptions, Worker, type Job } from "bullmq";
import { env } from "../config/env";
import { createWorkerConnection } from "../redis/connection";
import type { DocumentAnalysisJobData } from "../types/documentAnalysis";
import { runAndPersistDocumentAnalysis } from "../services/documentAnalysisOrchestrator";

export function createDocumentAnalysisWorker(): Worker<DocumentAnalysisJobData> {
  const worker = new Worker<DocumentAnalysisJobData>(
    env.CLEARPATH_ANALYSIS_QUEUE_NAME ?? "clearpath-ai-analysis",
    async (job: Job<DocumentAnalysisJobData>) => {
      return runAndPersistDocumentAnalysis(job.data);
    },
    {
      connection: createWorkerConnection() as ConnectionOptions,
      concurrency: 1,
      lockDuration: 15 * 60 * 1000,
      autorun: true
    }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[clearpath-ai-worker] job ${job?.id} failed:`, err);
  });

  process.on("unhandledRejection", (reason) => {
    // eslint-disable-next-line no-console
    console.error("[clearpath-ai-worker] unhandled rejection:", reason);
  });

  return worker;
}
