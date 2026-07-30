import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage, reportProgress } from "../stageReporter";
import { cleanExtractedText } from "../../services/ingestion/cleanText";
import { detectLanguage } from "../../services/ingestion/detectLanguage";
import { pgPool } from "../../db/pool";
import type { AnalysisState } from "./types";

export async function processCleaningStage(
  state: AnalysisState,
): Promise<AnalysisState> {
  const { job, workerId, rawText, ocrConfidence } = state;
  let { currentStatus } = state;
  const { documentId, userId } = job.data;

  const cleanResult = cleanExtractedText(rawText || "", ocrConfidence || 1);
  const cleanText = cleanResult.cleanText;

  if (!isStageCompleteOrPast(currentStatus, "CLEANING")) {
    await reportStage({
      documentId,
      userId,
      workerId,
      toStatus: "CLEANING",
      eventType: "text_cleaned",
      message: "Removed OCR noise and normalized whitespace",
      progress: 35,
      payload: { correctionsApplied: cleanResult.correctionsApplied },
    });

    const language = detectLanguage(cleanText);
    await pgPool.query(`UPDATE documents SET language = $1 WHERE id = $2`, [
      language.code,
      documentId,
    ]);

    await reportProgress({
      documentId,
      userId,
      stage: "CLEANING",
      eventType: "language_detected",
      message: `Detected language: ${language.name}`,
      progress: 38,
      payload: { language: language.code, languageName: language.name },
    });

    currentStatus = "CLEANING";
  }

  return { ...state, currentStatus, cleanText };
}
