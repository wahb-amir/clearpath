import type { NormalizedDocument } from "../../types/documentAnalysis";
import type { OfficialSourceSnippet } from "../officialSourceSearch";
import type { GuardrailDiagnostics } from "./types";
import type { Stage1, Stage2, Stage3, Stage4, Stage5 } from "./schemas";

/**
 * High-stakes keyword check used by the guardrails.
 *
 * Heuristic: if the document text mentions any of these terms
 * (eligibility, medical, eviction, …) the guardrail layer should be
 * more conservative about human review.
 */
function isHighStakesDocument(document: NormalizedDocument): boolean {
  const text = (document.source_text ?? "").trim().toLowerCase();
  const keywords = [
    "eligibility",
    "qualified",
    "qualifies",
    "appeal",
    "medical",
    "diagnosis",
    "prescription",
    "legal",
    "law",
    "lawsuit",
    "eviction",
    "benefit",
    "insurance",
    "deadline extension",
    "can the deadline be extended",
    "disability",
    "accommodation",
  ];
  return keywords.some((keyword) => text.includes(keyword));
}

/**
 * Build a structural summary of the safety-relevant signals from
 * Stages 1, 2, 3 and the official-source snippet set. Used to feed
 * the human-review reason text.
 */
export function summarizeGuardrailDiagnostics(
  stage1: Stage1,
  stage2: Stage2,
  stage3: Stage3,
  officialSnippets: OfficialSourceSnippet[],
  document: NormalizedDocument,
): GuardrailDiagnostics {
  const issueNotes: string[] = [];
  const highStakesDocument = isHighStakesDocument(document);

  if (highStakesDocument) {
    issueNotes.push(
      "High-stakes wording detected; human approval stays in the loop.",
    );
  }

  if (officialSnippets.length === 0) {
    issueNotes.push(
      "No official source snippets were available; verification falls back to document text only.",
    );
  }

  const anyUnverified = stage3.verified_items.some(
    (item) => item.status === "unverified" || item.status === "conflicting",
  );

  if (anyUnverified) {
    issueNotes.push(
      "One or more extracted claims could not be fully verified.",
    );
  }

  if (stage1.needs_human_review) {
    issueNotes.push(`Stage 1 review signal: ${stage1.human_review_reason}`);
  }

  const missingCriticalInfo = stage2.missing_info.length > 0;
  if (missingCriticalInfo) {
    issueNotes.push(
      "The document is missing critical context needed for a final answer.",
    );
  }

  return {
    high_stakes_document: highStakesDocument,
    official_source_count: officialSnippets.length,
    missing_verification: anyUnverified || officialSnippets.length === 0,
    issue_notes: issueNotes,
  };
}

/**
 * Deterministic Stage 5 guardrails.
 *
 * Runs in addition to the LLM-based safety review. Catches failure
 * modes the LLM might miss (high-stakes docs, no official sources,
 * unverified items, missing trusted sources, vague human-review
 * reasons) and produces a `Stage5`-shaped result that the orchestrator
 * merges with the LLM's output.
 */
export function buildStage5Guardrails(
  stage3: Stage3,
  stage4: Stage4,
  officialSnippets: OfficialSourceSnippet[],
  document: NormalizedDocument,
): Stage5 {
  const issues: Stage5["issues"] = [];

  const hasConflicts = stage3.verified_items.some(
    (item) => item.status === "conflicting",
  );
  const hasUnverified = stage3.verified_items.some(
    (item) => item.status === "unverified",
  );
  const highStakes = isHighStakesDocument(document);
  const reviewMissing =
    stage4.needs_human_review &&
    !/uncertain|needs review|not enough information/i.test(
      stage4.human_review_reason,
    );

  if (hasConflicts) {
    issues.push({
      type: "conflict",
      severity: "high",
      description: "At least one extracted item was marked conflicting.",
    });
  }

  if (hasUnverified) {
    issues.push({
      type: "missing_review",
      severity: "medium",
      description: "At least one extracted item was not fully verified.",
    });
  }

  if (highStakes) {
    issues.push({
      type: "unsafe_recommendation",
      severity: "high",
      description:
        "The document appears high-stakes; a human should make eligibility, appeal, medical, or legal decisions.",
    });
  }

  if (officialSnippets.length === 0) {
    issues.push({
      type: "missing_review",
      severity: "medium",
      description:
        "No official source snippets were available, so verification depends only on the uploaded text.",
    });
  }

  if (reviewMissing) {
    issues.push({
      type: "missing_review",
      severity: "medium",
      description:
        "Human review is required, but the reason does not clearly state the uncertainty.",
    });
  }

  if (
    stage4.trusted_sources.length === 0 &&
    (highStakes || hasUnverified || officialSnippets.length === 0)
  ) {
    issues.push({
      type: "missing_review",
      severity: "medium",
      description:
        "No trusted sources were retained for a document that needs verification.",
    });
  }

  const finalRecommendation = issues.some((issue) => issue.severity === "high")
    ? "revise"
    : "approve";

  return {
    pass: finalRecommendation === "approve",
    issues,
    final_recommendation: finalRecommendation,
  };
}
