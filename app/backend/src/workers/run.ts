import { Worker, type Job, type ConnectionOptions } from "bullmq";
import { createWorkerConnection } from "../redis/connection";
import { env } from "../config/env";
import { runAiPipeline } from "./aiAnalysisWorker";
import {
  handleStageInitialization,
  handleNodePipeline,
} from "./stagePipeline";
import type { AiAnalysisJobData } from "../types/dtos";

const worker = new Worker(
  env.ANALYSIS_QUEUE_NAME,
  async (job: Job) => {
    switch (job.name) {
      case "ai-analysis":
        return runAiPipeline(job as Job<AiAnalysisJobData>);
      case "stage-initialization":
        return handleStageInitialization(job as any);
      case "stage-node-pipeline":
        return handleNodePipeline(job as any);

      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  },
  {
    connection: createWorkerConnection() as ConnectionOptions,
    concurrency: 4,
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

// ioredis emits rejections on connection drops; without this guard
// Node 22's default policy (`unhandledRejection` = exit 1) would kill
// the worker on any transient Redis blip. Log and keep going.
process.on("unhandledRejection", (err) => {
  console.error("[worker] unhandledRejection (kept alive)", err);
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
