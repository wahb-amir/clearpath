import { isTrustedOfficialUrl, type OfficialSourceSnippet } from "../officialSourceSearch";
import type { GuardrailDiagnostics } from "./types";
import type { Stage1, Stage3, Stage4, Stage5 } from "./schemas";

/**
 * Ensure user-facing text acknowledges uncertainty when human review
 * is required. If a marker like "uncertain" / "needs review" is
 * already present we leave the text alone; otherwise we prefix the
 * "needs review:" sentinel so the reader sees a clear warning.
 */
export function enforceUncertaintyLanguage(
  text: string,
  reviewRequired: boolean,
  reason: string,
): string {
  if (!reviewRequired) return text;
  const lower = text.toLowerCase();
  const markers = ["uncertain", "needs review", "not enough information"];
  if (markers.some((marker) => lower.includes(marker))) return text;
  return `needs review: ${text.trim()}`.trim();
}

/**
 * Ensure the questions-to-ask list carries the human-review warning
 * when review is required. We only prepend a "needs review" question
 * when the list doesn't already flag uncertainty.
 */
export function normalizeQuestions(
  questions: string[],
  reviewRequired: boolean,
  reason: string,
): string[] {
  if (!reviewRequired || questions.length === 0) return questions;
  const hasMarker = questions.some((q) =>
    /uncertain|needs review|not enough information/i.test(q),
  );
  if (hasMarker) return questions;
  return [`needs review: ${reason}`, ...questions];
}

/**
 * Filter the trusted sources returned by Stage 4 down to only URLs
 * that came from the official-source snippets we retrieved, plus any
 * that the `isTrustedOfficialUrl` checker explicitly whitelists.
 * Dedupes by URL.
 */
export function sanitizeTrustedSources(
  sources: Stage4["trusted_sources"],
  officialSnippets: OfficialSourceSnippet[],
): Stage4["trusted_sources"] {
  const allowedUrls = new Set(officialSnippets.map((snippet) => snippet.url));
  const filtered = sources.filter(
    (source) => allowedUrls.has(source.url) || isTrustedOfficialUrl(source.url),
  );
  const seen = new Set<string>();
  const deduped: typeof filtered = [];
  for (const source of filtered) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    deduped.push(source);
  }
  return deduped;
}

/**
 * Build the single human-review reason string that the orchestrator
 * stores in the final result. Pulls from the per-stage reasons plus
 * the guardrail issue notes (in priority order), then runs the text
 * through `enforceUncertaintyLanguage` so the sentinel is present.
 */
export function mergeHumanReviewReason(
  stage1: Stage1,
  stage3: Stage3,
  stage4: Stage4,
  stage5: Stage5,
  guardrails: GuardrailDiagnostics,
): string {
  const parts = [
    stage4.human_review_reason,
    stage3.human_review_reason,
    stage1.human_review_reason,
    ...guardrails.issue_notes,
    stage5.issues.map((issue) => issue.description).join(" "),
  ]
    .map((part) => part.trim())
    .filter(Boolean);

  const reason = parts[0] ?? "Needs human review.";
  return enforceUncertaintyLanguage(reason, true, reason);
}
