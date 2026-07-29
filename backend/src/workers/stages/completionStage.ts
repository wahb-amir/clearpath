import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage } from "../stageReporter";
import { withTransaction } from "../../db/pool";
import type { AnalysisState } from "./types";

export async function processCompletionStage(state: AnalysisState): Promise<void> {
  const { job, workerId } = state;
  let { currentStatus } = state;
  const { documentId, userId, analysisRequestId, analysisVersion } = job.data;

  if (!isStageCompleteOrPast(currentStatus, "PREPROCESSING_COMPLETED")) {
    await reportStage({
      documentId,
      userId,
      workerId,
      toStatus: "PREPROCESSING_COMPLETED",
      eventType: "preprocessing_completed",
      message: "Preprocessing complete — queuing AI analysis",
      progress: 95,
    });
    currentStatus = "PREPROCESSING_COMPLETED";

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO document_pipeline_outbox
           (event_type, aggregate_type, aggregate_id, payload, status)
         VALUES ('document.preprocessing.completed', 'document_analysis_request', $1, $2::jsonb, 'pending')`,
        [
          analysisRequestId,
          JSON.stringify({
            documentId,
            userId,
            analysisRequestId,
            analysisVersion,
          }),
        ],
      );
    });
  }
}
