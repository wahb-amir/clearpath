import { Queue, type ConnectionOptions } from "bullmq";
import { createQueueConnection } from "../redis/connection";
import { env } from "../config/env";
import type { AnalysisJobData, AiAnalysisJobData } from "../types/dtos";

export type AnalysisQueueJobName = "analyze-document" | "ai-analysis";
export type AnalysisQueueJobData = AnalysisJobData | AiAnalysisJobData;

export const analysisQueue = new Queue<AnalysisQueueJobData, AnalysisQueueJobName>(
  env.ANALYSIS_QUEUE_NAME,
  {
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
  },
);

export async function enqueueAnalysisJob(
  jobId: string,
  data: AnalysisJobData,
): Promise<void> {
  const safeJobId = jobId.replace(/:/g, "-");

  await analysisQueue.add("analyze-document", data, {
    jobId: safeJobId,
  });
}

export async function enqueueAiAnalysisJob(
  jobId: string,
  data: AiAnalysisJobData,
): Promise<void> {
  const safeJobId = jobId.replace(/:/g, "-");

  await analysisQueue.add("ai-analysis", data, {
    jobId: safeJobId,
  });
}