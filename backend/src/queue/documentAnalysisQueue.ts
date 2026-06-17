import { ConnectionOptions, Queue, type JobsOptions } from "bullmq";
import { env } from "../config/env";
import { createWorkerConnection } from "../redis/connection";
import type {DocumentAnalysisJobData} from "../types/documentAnalysis"

let queueInstance: Queue<DocumentAnalysisJobData> | null = null;

export function getDocumentAnalysisQueue(): Queue<DocumentAnalysisJobData> {
  if (!queueInstance) {
    queueInstance = new Queue(
      env.CLEARPATH_ANALYSIS_QUEUE_NAME ,
      {
        connection: createWorkerConnection() as ConnectionOptions
      }
    ) as Queue<DocumentAnalysisJobData>;
  }

  return queueInstance;
}

export async function enqueueDocumentAnalysis(
  jobData: DocumentAnalysisJobData,
  options: JobsOptions = {}
) {
  const queue = getDocumentAnalysisQueue();
  return queue.add("run-clearpath-analysis", jobData, {
    jobId: jobData.analysisRequestId,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
    ...options
  });
}
