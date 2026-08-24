import type { NormalizedDocument, DocumentAnalysisPipelineResult } from "../../types/documentAnalysis";
import {
  Stage4Schema,
  type Stage1,
  type Stage2,
  type Stage3,
  type Stage4,
  type Stage5,
} from "../documentAnalysisPipeline/schemas";
import {
  makeStage1Fallback,
  makeStage2Fallback,
  makeStage3Fallback,
  makeStage4Fallback,
  makeStage5Fallback,
} from "../documentAnalysisPipeline/fallbacks";
import {
  buildStage5Guardrails,
  summarizeGuardrailDiagnostics,
} from "../documentAnalysisPipeline/guardrails";
import {
  enforceUncertaintyLanguage,
  mergeHumanReviewReason,
  normalizeQuestions,
  sanitizeTrustedSources,
} from "../documentAnalysisPipeline/sanitizers";
import { askGroqJsonStreaming } from "../documentAnalysisPipeline/llmClient";
import { buildStage4Prompt } from "../documentAnalysisPipeline/prompts";
import type { OfficialSourceSnippet } from "../officialSourceSearch";
import type { FinalPayload } from "./types";

export interface BuildFinalResultInput {
  document: NormalizedDocument;
  /** Optional Stage 1 from a classify_document tool. Falls back to a safe default. */
  stage1?: Stage1;
  stage2?: Stage2;
  stage3?: Stage3;
  /** Whatever the agent emitted via the finalize tool, OR the synthesis fallback. */
  stage4: Stage4;
  /** Snippets accumulated from web_search tools + run-level initial snippets. */
  officialSnippets: OfficialSourceSnippet[];
}

/**
 * Deterministic post-merge for the agentic pipeline. Reuses every
 * sanitizer/guardrail used by the classic pipeline so the result shape
 * is byte-for-byte equivalent. No duplicated logic.
 */
export async function buildFinalResult(
  input: BuildFinalResultInput,
): Promise<DocumentAnalysisPipelineResult> {
  const stage1 = input.stage1 ?? makeStage1Fallback(input.document);
  const stage2 = input.stage2 ?? makeStage2Fallback();
  const stage3 = input.stage3 ?? makeStage3Fallback();
  const stage4 = input.stage4;

  const guardrails = buildStage5Guardrails(
    stage3,
    stage4,
    input.officialSnippets,
    input.document,
  );

  const baseStage5 = makeStage5Fallback();
  const stage5: Stage5 = {
    ...baseStage5,
    issues: [...baseStage5.issues, ...guardrails.issues],
    final_recommendation:
      guardrails.final_recommendation === "revise" ||
      baseStage5.final_recommendation === "block"
        ? "revise"
        : guardrails.final_recommendation,
  };

  const guardrailDiagnostics = summarizeGuardrailDiagnostics(
    stage1,
    stage2,
    stage3,
    input.officialSnippets,
    input.document,
  );

  const humanReviewRequired =
    stage1.needs_human_review ||
    stage3.needs_human_review ||
    stage4.needs_human_review ||
    stage5.final_recommendation !== "approve";

  const humanReviewReason = mergeHumanReviewReason(stage1, stage3, stage4, stage5, {
    ...guardrailDiagnostics,
    issue_notes: guardrails.issues.map((issue) => issue.description),
  });

  const trustedSources = sanitizeTrustedSources(
    stage4.trusted_sources,
    input.officialSnippets,
  );

  const summary = enforceUncertaintyLanguage(
    stage4.ai_summary,
    humanReviewRequired,
    humanReviewReason,
  );

  const questions = normalizeQuestions(
    stage4.questions_to_ask,
    humanReviewRequired,
    humanReviewReason,
  );

  return {
    summary,
    action_items: stage4.action_items,
    key_deadlines: stage4.key_deadlines,
    questions_to_ask: questions,
    ai_confidence: stage4.ai_confidence,
    trusted_sources: trustedSources,
    stage_outputs: {
      stage1,
      stage2,
      stage3,
      stage4: {
        ...stage4,
        ai_summary: summary,
        questions_to_ask: questions,
        trusted_sources: trustedSources,
        needs_human_review: humanReviewRequired,
        human_review_reason: humanReviewReason,
      },
      stage5,
      guardrails: {
        ...guardrails,
        official_source_count: input.officialSnippets.length,
      },
    },
    status: "completed",
  };
}

/**
 * When the agent loop exits without calling `finalize` (max-iters, loop
 * detected, hard abort) we synthesize a Stage 4 from whatever was
 * accumulated via the classic prompt. This matches the fallback path
 * the classic pipeline uses internally.
 */
export async function synthesizeStage4Fallback(input: {
  document: NormalizedDocument;
  stage3: Stage3;
  officialSnippets: OfficialSourceSnippet[];
}): Promise<Stage4> {
  const stage1 = makeStage1Fallback(input.document);
  const stage2 = makeStage2Fallback();
  // Reuse the same Stage 4 prompt the classic pipeline uses.
  const fallback = await askGroqJsonStreaming<Stage4>(
    buildStage4Prompt(input.stage3, input.document, input.officialSnippets),
    Stage4Schema,
    makeStage4Fallback(input.document),
    0.15,
    "agentic-fallback-synthesis",
    undefined,
    30000,
  );
  return fallback;
}

/** Adapter for callers that already built a FinalPayload. */
export async function buildFinalResultFromPayload(params: {
  document: NormalizedDocument;
  payload: FinalPayload;
  officialSnippets: OfficialSourceSnippet[];
  stage1?: Stage1;
  stage2?: Stage2;
  stage3?: Stage3;
}): Promise<DocumentAnalysisPipelineResult> {
  return buildFinalResult({
    document: params.document,
    stage1: params.stage1,
    stage2: params.stage2 ?? params.payload.stage4 ? undefined : undefined,
    stage3: params.stage3,
    stage4: params.payload.stage4,
    officialSnippets: params.officialSnippets,
  });
}
