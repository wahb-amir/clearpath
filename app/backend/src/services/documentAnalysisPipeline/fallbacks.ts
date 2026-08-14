import type { NormalizedDocument } from "../../types/documentAnalysis";
import type { Stage1, Stage2, Stage3, Stage4, Stage5 } from "./schemas";

/**
 * Stage 1 fallback when the LLM call fails or returns invalid output.
 * Marks everything as "needs review" so the rest of the pipeline can
 * still run and surface the failure to a human reviewer.
 */
export function makeStage1Fallback(document: NormalizedDocument): Stage1 {
  return {
    document_type: "other",
    primary_topic: "unclear",
    intended_audience: "unclear",
    is_support_related: false,
    possible_user_problem: "needs review",
    contains_deadlines: false,
    contains_actions: false,
    contains_risks: false,
    needs_human_review: true,
    human_review_reason: "needs review: model output could not be validated",
    document_language:
      document.language === "en" ||
      document.language === "es" ||
      document.language === "ur"
        ? document.language
        : "unclear",
    confidence: 0,
  };
}

/**
 * Stage 2 fallback — no facts extracted, but a placeholder
 * `missing_info` entry that signals the extraction stage failed.
 */
export function makeStage2Fallback(): Stage2 {
  return {
    deadlines: [],
    actions: [],
    risks: [],
    contacts: [],
    missing_info: [
      {
        question: "What information could not be extracted safely?",
        reason: "needs review: model output could not be validated",
        confidence: 0,
      },
    ],
  };
}

/**
 * Stage 3 fallback — nothing verified, with a high-severity note.
 */
export function makeStage3Fallback(): Stage3 {
  return {
    verified_items: [],
    verification_notes: [
      {
        note: "Model output could not be validated.",
        severity: "high",
      },
    ],
    needs_human_review: true,
    human_review_reason: "needs review: verification stage failed validation",
    overall_confidence: 0,
  };
}

/**
 * Stage 4 fallback — no actions, no deadlines, no trusted sources,
 * and a single prompt question asking what needs manual review.
 */
export function makeStage4Fallback(document: NormalizedDocument): Stage4 {
  return {
    ai_summary: "needs review: model output could not be validated",
    action_items: [],
    key_deadlines: [],
    questions_to_ask: ["What parts of this document need manual review?"],
    ai_confidence: {
      overall: 0,
      summary: 0,
      actions: 0,
      deadlines: 0,
      questions: 0,
    },
    trusted_sources: [],
    needs_human_review: true,
    human_review_reason: "needs review: synthesis stage failed validation",
  };
}

/**
 * Stage 5 fallback — block with a high-severity missing-review issue.
 * This is the most pessimistic recommendation the pipeline can give
 * and is reserved for when the safety review itself can't run.
 */
export function makeStage5Fallback(): Stage5 {
  return {
    pass: false,
    issues: [
      {
        type: "missing_review",
        severity: "high",
        description:
          "Model output failed validation and was replaced with a safe fallback.",
      },
    ],
    final_recommendation: "block",
  };
}
