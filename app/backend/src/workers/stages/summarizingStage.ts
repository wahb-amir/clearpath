import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage } from "../stageReporter";
import type { AnalysisState } from "./types";

export async function processSummarizingStage(
  state: AnalysisState,
): Promise<AnalysisState> {
  const { job, workerId, title, summary } = state;
  let { currentStatus } = state;
  const { documentId, userId } = job.data;

  if (!isStageCompleteOrPast(currentStatus, "SUMMARIZING")) {
    await reportStage({
      documentId,
      userId,
      workerId,
      toStatus: "SUMMARIZING",
      eventType: "summary_created",
      message: "Generated document summary",
      progress: 90,
      payload: { title, summary },
    });
    currentStatus = "SUMMARIZING";
  }

  return { ...state, currentStatus };
}
