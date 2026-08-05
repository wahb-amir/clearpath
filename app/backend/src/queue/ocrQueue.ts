import { Queue, type ConnectionOptions } from "bullmq";
import { createQueueConnection } from "../redis/connection";
import { env } from "../config/env";
import type { InitializationCompletedPayload } from "../types/dtos";

/**
 * Dedicated queue for the Stage-2 (extraction/OCR) job, consumed
 * exclusively by the Python `ocr-engine` service. Kept SEPARATE from
 * `analysisQueue` (the Node-only queue) on purpose: two different
 * language runtimes as competing consumers on one BullMQ queue means
 * either side can dequeue a job it doesn't own, forcing a
 * reject-and-retry dance. A dedicated queue makes that whole class of
 * bug structurally impossible - Node never even connects a Worker to
 * this queue, so it can never claim a job here.
 */
export const ocrQueue = new Queue<InitializationCompletedPayload, unknown, "extract-layout-and-ocr">(
  env.OCR_QUEUE_NAME,
  {
    connection: createQueueConnection() as ConnectionOptions,
    defaultJobOptions: {
      attempts: env.OCR_JOB_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
      },
    },
  },
);

function safeJobId(jobId: string): string {
  return jobId.replace(/:/g, "-");
}

export async function enqueueOcrJob(
  jobId: string,
  data: InitializationCompletedPayload,
): Promise<void> {
  await ocrQueue.add("extract-layout-and-ocr", data, { jobId: safeJobId(jobId) });
}
