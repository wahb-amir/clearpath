import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage } from "../stageReporter";
import type { AnalysisState } from "./types";

export async function processInitializationStage(state: AnalysisState): Promise<AnalysisState> {
  const { job, workerId } = state;
  let { currentStatus } = state;
  const { documentId, userId } = job.data;

  if (!isStageCompleteOrPast(currentStatus, "PROCESSING")) {
    await reportStage({
      documentId,
      userId,
      workerId,
      toStatus: "PROCESSING",
      eventType: "worker_assigned",
      message: `Worker ${workerId} picked up the job`,
      progress: 5,
    });
    currentStatus = "PROCESSING";
  }

  return { ...state, currentStatus };
}
