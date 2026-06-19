import type { DocumentSectionDraft } from "./buildStructure";

/**
 * Generates a lightweight extractive document summary and title
 * without calling an external LLM (keeps the pipeline self-contained
 * and free). If you later wire up an LLM summarizer, swap the body of
 * `generateSummary` - the return shape stays the same.
 *
 * Strategy:
 *  - title: first top-level heading, or first non-empty line of text
 *  - summary: first 1-2 sentences of each top-level section,
 *    concatenated, capped at ~500 chars
 */
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
      .find((l) => l.trim().length > 0)
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
