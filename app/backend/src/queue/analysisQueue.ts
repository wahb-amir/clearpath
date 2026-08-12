import { Queue, type ConnectionOptions } from "bullmq";
import { createQueueConnection } from "../redis/connection";
import { env } from "../config/env";
import type {
  AiAnalysisJobData,
  AnalysisJobData,
  InitializationCompletedPayload,
  ExtractionCompletedPayload,
} from "../types/dtos";

/**
 * The atomic pipeline stages share ONE BullMQ queue, distinguished by
 * job name. The Python-owned OCR stage lives on its own separate
 * queue (see `ocrQueue.ts`) so it's never a competing consumer here.
 */
export type AnalysisQueueJobName =
  | "ai-analysis"
  | "stage-initialization"
  | "stage-node-pipeline";

export type AnalysisQueueJobData =
  | AiAnalysisJobData
  | InitializationCompletedPayload // == AnalysisJobData shape, used by stage-initialization
  | ExtractionCompletedPayload; // consumed by stage-node-pipeline


export const analysisQueue = new Queue<
  AnalysisQueueJobData,
  unknown,
  AnalysisQueueJobName
>(env.ANALYSIS_QUEUE_NAME, {
  connection: createQueueConnection() as ConnectionOptions,
  defaultJobOptions: {
    attempts: env.ANALYSIS_JOB_ATTEMPTS,
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
});

function safeJobId(jobId: string): string {
  return jobId.replace(/:/g, "-");
}

export async function enqueueAiAnalysisJob(
  jobId: string,
  data: AiAnalysisJobData,
): Promise<void> {
  await analysisQueue.add("ai-analysis", data, { jobId: safeJobId(jobId) });
}

/**
 * Generic enqueue for atomic pipeline-stage jobs. The dispatcher calls
 * this for every stage transition. `jobId` should be deterministic
 * (e.g. `${analysisRequestId}-${jobName}`) so that a duplicated outbox
 * dispatch (retry, at-least-once delivery) is deduplicated by BullMQ
 * instead of creating a second run of the same stage.
 */
export async function enqueueStageJob(
  jobName: Exclude<AnalysisQueueJobName, "ai-analysis">,
  jobId: string,
  data: AnalysisQueueJobData,
): Promise<void> {
  await analysisQueue.add(jobName, data, { jobId: safeJobId(jobId) });
}
