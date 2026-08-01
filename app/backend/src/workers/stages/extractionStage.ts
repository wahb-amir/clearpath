import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage, reportProgress } from "../stageReporter";
import { detectFileCategory } from "./detectFileType";
import { extractText } from "../../services/ingestion/extractText";
import { estimateQuality } from "../../services/ingestion/estimateQuality";
import { pgPool } from "../../db/pool";
import { supabase } from "../../lib/supabase";
import type { AnalysisState } from "./types";

/** Downloads the uploaded file from Supabase Storage. */
async function downloadFromStorage(storagePath: string): Promise<Buffer> {
  const BUCKET = "documents";
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new Error(
      `Failed to download ${storagePath} from storage: ${error?.message}`,
    );
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function processExtractionStage(
  state: AnalysisState,
): Promise<AnalysisState> {
  const { job, workerId } = state;
  let { currentStatus } = state;
  const { documentId, userId, storagePath, mimeType } = job.data;

  let rawText = "";
  let extractionMethod: "embedded" | "ocr" | "plain_text" = "plain_text";
  let ocrConfidence = 1;
  let textCoverage = 1;
  let usedOcrFallback = false;

  if (!isStageCompleteOrPast(currentStatus, "EXTRACTING")) {
    await reportStage({
      documentId,
      userId,
      workerId,
      toStatus: "EXTRACTING",
      eventType: "extraction_started",
      message: "Detecting file type and extracting text",
      progress: 10,
    });

    const fileBuffer = await downloadFromStorage(storagePath);
    const category = detectFileCategory(mimeType);

    const extraction = await extractText({
      fileBuffer,
      category,
      mimeType,
      onPageProgress: async (current, total) => {
        await reportProgress({
          documentId,
          userId,
          stage: "EXTRACTING",
          eventType: "extraction_progress",
          message: `Processed page ${current} of ${total}`,
          progress: 10 + Math.round((current / total) * 15),
          payload: { currentPage: current, totalPages: total },
        });
      },
    });

    rawText = extraction.rawText;
    extractionMethod = extraction.method;
    ocrConfidence = extraction.ocrConfidence;
    textCoverage = extraction.textCoverage;
    usedOcrFallback = extraction.usedOcrFallback;

    if (usedOcrFallback) {
      await reportProgress({
        documentId,
        userId,
        stage: "EXTRACTING",
        eventType: "ocr_fallback_started",
        message: "Sparse embedded text detected - OCR fallback applied",
        progress: 25,
        payload: { ocrConfidence },
      });
    }

    currentStatus = "EXTRACTING";

    await pgPool.query(
      `UPDATE documents SET ocr_confidence = $1 WHERE id = $2`,
      [ocrConfidence, documentId],
    );
  } else {
    const fileBuffer = await downloadFromStorage(storagePath);
    const category = detectFileCategory(mimeType);
    const extraction = await extractText({ fileBuffer, category, mimeType });
    rawText = extraction.rawText;
    extractionMethod = extraction.method;
    ocrConfidence = extraction.ocrConfidence;
    textCoverage = extraction.textCoverage;
  }

  return {
    ...state,
    currentStatus,
    rawText,
    extractionMethod,
    ocrConfidence,
    textCoverage,
    usedOcrFallback,
    quality: estimateQuality({ ocrConfidence, textCoverage }),
  };
}
