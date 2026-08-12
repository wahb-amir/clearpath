import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage } from "../stageReporter";
import type { AnalysisState } from "./types";

export async function processEmbeddingStage(
  state: AnalysisState,
): Promise<AnalysisState> {
  const { job, workerId } = state;
  let { currentStatus } = state;
  const { documentId, userId } = job.data;

  // EMBEDDING STAGE — commented out in pipeline (not currently used).
  // Kept here for future RAG implementation.
  /*
  if (!isStageCompleteOrPast(currentStatus, "EMBEDDING")) {
    await reportStage({
      documentId,
      userId,
      workerId,
      toStatus: "EMBEDDING",
      eventType: "embedding_completed",
      message: "Generated embeddings for all chunks (bge-small-en-v1.5)",
      progress: 80,
    });
    currentStatus = "EMBEDDING";
  }
  */

  return { ...state, currentStatus };
}
