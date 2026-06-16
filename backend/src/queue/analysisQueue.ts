import { Queue, type ConnectionOptions } from 'bullmq';
import { createQueueConnection } from '../redis/connection';
import { env } from '../config/env';
import type { AnalysisJobData } from '../types/dtos';

/**
 * Single queue for document analysis jobs. The dispatcher (outbox
 * reader) is the ONLY producer that should add jobs here - this keeps
 * "enqueue" tied to the outbox-confirmed-sent transition.
 */
export const analysisQueue = new Queue<AnalysisJobData, 'analyze-document'>(env.ANALYSIS_QUEUE_NAME, {
  connection: createQueueConnection() as ConnectionOptions,
  defaultJobOptions: {
    attempts: env.ANALYSIS_JOB_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s, 40s, 80s...
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // keep completed jobs for 1 day
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // keep failed jobs for 7 days for inspection / DLQ-style review
    },
  },
});

/**
 * Enqueue a job with a deterministic jobId derived from the analysis
 * request id. Sanitizes the jobId to ensure no colons (':') are present,
 * as BullMQ uses colons as Redis key separators.
 */
export async function enqueueAnalysisJob(
  jobId: string,
  data: AnalysisJobData,
): Promise<void> {
  // Sanitize the jobId: replace all colons with hyphens
  const safeJobId = jobId.replace(/:/g, '-');

  await analysisQueue.add('analyze-document', data, {
    jobId: safeJobId,
  });
}