import type { DocumentSectionDraft } from "../../services/ingestion/buildStructure";
import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage } from "../stageReporter";
import type { AnalysisState } from "./types";

export interface DocumentSummaryResult {
  title: string;
  summary: string;
}

const SENTENCE_SPLIT = /(?<=[.!?\u06D4])\s+/;
const MAX_SUMMARY_CHARS = 600;

export function generateSummary(params: {
  cleanText: string;
  sections: DocumentSectionDraft[];
}): DocumentSummaryResult {
  const { cleanText, sections } = params;

  const title =
    sections.find((s) => s.title)?.title ??
    cleanText
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim()
      .slice(0, 120) ??
    "Untitled document";

  const pieces: string[] = [];

  for (const section of sections) {
    const text = section.textContent.trim() || section.title || "";
    if (!text) continue;
    const sentences = text.split(SENTENCE_SPLIT).filter((s) => s.trim());
    if (sentences.length > 0) {
      pieces.push(sentences[0].trim());
    }
    if (pieces.join(" ").length > MAX_SUMMARY_CHARS) break;
  }

  let summary = pieces.join(" ");
  if (summary.length === 0) {
    summary = cleanText.slice(0, MAX_SUMMARY_CHARS).trim();
  }
  if (summary.length > MAX_SUMMARY_CHARS) {
    summary = summary.slice(0, MAX_SUMMARY_CHARS).trim() + "…";
  }

  return { title, summary };
}

export async function processSummarizingStage(
  state: AnalysisState,
): Promise<AnalysisState> {
  const { job, workerId, title: existingTitle, summary: existingSummary, markdownContent, sections = [] } = state;
  let { currentStatus } = state;
  const { documentId, userId } = job.data;

  const generated =
    existingTitle && existingSummary
      ? { title: existingTitle, summary: existingSummary }
      : generateSummary({
          cleanText: markdownContent ?? "",
          sections,
        });

  const title = existingTitle ?? generated.title;
  const summary = existingSummary ?? generated.summary;

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

  return { ...state, currentStatus, title, summary };
}
