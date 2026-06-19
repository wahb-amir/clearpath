import { Worker, type Job, type ConnectionOptions } from "bullmq";
import { createWorkerConnection } from "../redis/connection";
import { env } from "../config/env";
import { runAiPipeline } from "./aiAnalysisWorker";
import { processAnalysisJob } from "./analysisWorker";
import type { AnalysisJobData, AiAnalysisJobData } from "../types/dtos";

const worker = new Worker(
  env.ANALYSIS_QUEUE_NAME,
  async (job: Job) => {
    switch (job.name) {
      case "analyze-document":
        return processAnalysisJob(job as Job<AnalysisJobData>);
      case "ai-analysis":
        return runAiPipeline(job as Job<AiAnalysisJobData>);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  },
  {
    connection: createWorkerConnection() as ConnectionOptions,
    concurrency: 2,
    lockDuration: 10 * 60 * 1000,
  },
);

worker.on("active", (job) => {
  console.log("[worker] ACTIVE", job.id, job.name);
});

worker.on("failed", (job, err) => {
  console.error("[worker] FAILED", job?.id, job?.name, err);
});

worker.on("completed", (job) => {
  console.log("[worker] COMPLETED", job.id, job.name);
});
async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(
  `[worker] started (queue=${env.ANALYSIS_QUEUE_NAME}, workerId=${env.WORKER_ID})`,
);
