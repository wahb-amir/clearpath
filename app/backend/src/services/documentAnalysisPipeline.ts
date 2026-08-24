import type {
  DocumentAnalysisPipelineResult,
  NormalizedDocument,
} from "../types/documentAnalysis";
import { buildOfficialSourceSnippets } from "./documentAnalysisPipeline/buildOfficialSourceSnippets";
import {
  buildStage5Guardrails,
  summarizeGuardrailDiagnostics,
} from "./documentAnalysisPipeline/guardrails";
import {
  
  buildStage1Prompt,
  buildStage2Prompt,
  buildStage3Prompt,
  buildStage4Prompt,
  buildStage5Prompt,
} from "./documentAnalysisPipeline/prompts";
import {
  makeStage1Fallback,
  makeStage2Fallback,
  makeStage3Fallback,
  makeStage4Fallback,
  makeStage5Fallback,
} from "./documentAnalysisPipeline/fallbacks";
import { askGroqJsonStreaming } from "./documentAnalysisPipeline/llmClient";
import {
  enforceUncertaintyLanguage,
  mergeHumanReviewReason,
  normalizeQuestions,
  sanitizeTrustedSources,
} from "./documentAnalysisPipeline/sanitizers";
import {
  Stage1Schema,
  Stage2Schema,
  Stage3Schema,
  Stage4Schema,
  Stage5Schema,
  type Stage5,
} from "./documentAnalysisPipeline/schemas";
import type {
  PipelineEventEmitter,
  PipelineOptions,
} from "./documentAnalysisPipeline/types";

export const CLEARPATH_PIPELINE_VERSION = "2026-08-15";

export async function runClearPathPipeline(
  document: NormalizedDocument,
  options: PipelineOptions = {},
  emit?: PipelineEventEmitter,
): Promise<DocumentAnalysisPipelineResult> {
  // ── Stage 1: Document Understanding ──────────────────────────────────────
  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_understanding_started",
    stage: "AI_PROCESSING",
    message: "Stage 1/5 — Understanding document type, audience, and intent",
    progress: 10,
    payload: { stage: 1, total: 5 },
  });

  const stage1 = await askGroqJsonStreaming(
    buildStage1Prompt(document),
    Stage1Schema,
    makeStage1Fallback(document),
    0,
    "stage1",
    async (tokens) => {
      await emit?.({
        documentId: document.document_id,
        userId: document.user_id,
        eventType: "ai_understanding_started",
        stage: "AI_PROCESSING",
        message: `Reading document — analysing structure (${tokens} chars received)`,
        progress: 10 + Math.min(8, Math.floor(tokens / 120)),
        payload: { stage: 1, total: 5, tokens_received: tokens },
      });
    },

  );

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_understanding_completed",
    stage: "AI_PROCESSING",
    message: `Stage 1/5 complete — Document: "${stage1.document_type}", topic: "${stage1.primary_topic}"`,
    progress: 20,
    payload: {
      stage: 1,
      total: 5,
      document_type: stage1.document_type,
      primary_topic: stage1.primary_topic,
      intended_audience: stage1.intended_audience,
      contains_deadlines: stage1.contains_deadlines,
      contains_actions: stage1.contains_actions,
      contains_risks: stage1.contains_risks,
      confidence: stage1.confidence,
    },
  });

  // ── Stage 2: Candidate Extraction ─────────────────────────────────────────
  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_extraction_started",
    stage: "AI_PROCESSING",
    message: "Stage 2/5 — Extracting deadlines, actions, risks, and contacts",
    progress: 22,
    payload: { stage: 2, total: 5 },
  });

  const stage2 = await askGroqJsonStreaming(
    buildStage2Prompt(document, stage1),
    Stage2Schema,
    makeStage2Fallback(),
    0,
    "stage2",
    async (tokens) => {
      await emit?.({
        documentId: document.document_id,
        userId: document.user_id,
        eventType: "ai_extraction_started",
        stage: "AI_PROCESSING",
        message: `Scanning for dates, deadlines, and required actions (${tokens} chars)`,
        progress: 22 + Math.min(10, Math.floor(tokens / 150)),
        payload: { stage: 2, total: 5, tokens_received: tokens },
      });
    },

  );

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_extraction_completed",
    stage: "AI_PROCESSING",
    message: `Stage 2/5 complete — Found ${stage2.deadlines.length} deadlines, ${stage2.actions.length} actions, ${stage2.risks.length} risks, ${stage2.contacts.length} contacts`,
    progress: 35,
    payload: {
      stage: 2,
      total: 5,
      deadline_count: stage2.deadlines.length,
      action_count: stage2.actions.length,
      risk_count: stage2.risks.length,
      contact_count: stage2.contacts.length,
      missing_info_count: stage2.missing_info.length,
    },
  });

  // ── Stage 3 (pre): Web Search Routing + Grounding ─────────────────────────
  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_verification_started",
    stage: "AI_PROCESSING",
    message: "Stage 3/5 — Routing web search for grounding",
    progress: 37,
    payload: {
      stage: 3,
      total: 5,
      sub_step: "search",
      max_searches: options.maxSearches ?? 3,
    },
  });

  const officialSnippets = await buildOfficialSourceSnippets(
    document,
    stage1,
    stage2,
    options,
    emit,
  );

  // ── Stage 3 (post): Verification ─────────────────────────────────────────
  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_verification_started",
    stage: "AI_PROCESSING",
    message: `Stage 3/5 — Verifying ${officialSnippets.length} source snippets against extracted items`,
    progress: 55,
    payload: {
      stage: 3,
      total: 5,
      sub_step: "verify",
      official_source_count: officialSnippets.length,
    },
  });

  const stage3Prompt = buildStage3Prompt(document, stage2, officialSnippets);

  if (stage3Prompt.report.document_truncated || stage3Prompt.report.snippets_dropped > 0) {
    console.warn(
      `[stage3] payload trimmed to fit token budget: doc ${stage3Prompt.report.document_kept_chars}/${stage3Prompt.report.document_original_chars} chars, ` +
        `snippets trimmed=${stage3Prompt.report.snippets_trimmed}, dropped=${stage3Prompt.report.snippets_dropped}, ` +
        `estimated_input_tokens=${stage3Prompt.report.estimated_input_tokens}`,
    );
  }

  const stage3 = await askGroqJsonStreaming(
    stage3Prompt.messages,
    Stage3Schema,
    makeStage3Fallback(),
    0,
    "stage3",
    async (tokens) => {
      await emit?.({
        documentId: document.document_id,
        userId: document.user_id,
        eventType: "ai_verification_started",
        stage: "AI_PROCESSING",
        message: `Cross-referencing extracted items with official sources (${tokens} chars)`,
        progress: 55 + Math.min(10, Math.floor(tokens / 120)),
        payload: {
          stage: 3,
          total: 5,
          tokens_received: tokens,
          payload_trimmed:
            stage3Prompt.report.document_truncated ||
            stage3Prompt.report.snippets_dropped > 0,
          estimated_input_tokens: stage3Prompt.report.estimated_input_tokens,
        },
      });
    },
    60000,
  );

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_verification_completed",
    stage: "AI_PROCESSING",
    message: `Stage 3/5 complete — ${stage3.verified_items.length} items verified (confidence ${Math.round(stage3.overall_confidence * 100)}%)`,
    progress: 68,
    payload: {
      stage: 3,
      total: 5,
      verified_count: stage3.verified_items.filter(
        (i) => i.status === "verified",
      ).length,
      partial_count: stage3.verified_items.filter(
        (i) => i.status === "partially_verified",
      ).length,
      unverified_count: stage3.verified_items.filter(
        (i) => i.status === "unverified",
      ).length,
      conflicting_count: stage3.verified_items.filter(
        (i) => i.status === "conflicting",
      ).length,
      overall_confidence: stage3.overall_confidence,
      needs_human_review: stage3.needs_human_review,
    },
  });

  // ── Stage 4: User-Facing Synthesis ────────────────────────────────────────
  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_synthesis_started",
    stage: "AI_PROCESSING",
    message: "Stage 4/5 — Writing plain-language summary and action items",
    progress: 70,
    payload: { stage: 4, total: 5 },
  });

  const stage4Raw = await askGroqJsonStreaming(
    buildStage4Prompt(stage3, document, officialSnippets),
    Stage4Schema,
    makeStage4Fallback(document),
    0.15,
    "stage4",
    async (tokens) => {
      await emit?.({
        documentId: document.document_id,
        userId: document.user_id,
        eventType: "ai_synthesis_started",
        stage: "AI_PROCESSING",
        message: `Composing plain-language summary for families (${tokens} chars)`,
        progress: 70 + Math.min(12, Math.floor(tokens / 150)),
        payload: { stage: 4, total: 5, tokens_received: tokens },
      });
    },
    75000,
  );

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_summary_delta",
    stage: "AI_PROCESSING",
    message: `Stage 4/5 complete — ${stage4Raw.action_items.length} action items, ${stage4Raw.key_deadlines.length} key deadlines, ${stage4Raw.trusted_sources.length} trusted sources`,
    progress: 85,
    payload: {
      stage: 4,
      total: 5,
      action_item_count: stage4Raw.action_items.length,
      deadline_count: stage4Raw.key_deadlines.length,
      question_count: stage4Raw.questions_to_ask.length,
      trusted_source_count: stage4Raw.trusted_sources.length,
      ai_confidence: stage4Raw.ai_confidence,
      needs_human_review: stage4Raw.needs_human_review,
    },
  });

  // ── Stage 5: Safety Review ────────────────────────────────────────────────
  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_safety_started",
    stage: "AI_PROCESSING",
    message: "Stage 5/5 — Running safety guardrails review",
    progress: 87,
    payload: { stage: 5, total: 5 },
  });

  const stage5Raw = await askGroqJsonStreaming(
    buildStage5Prompt(document, stage4Raw),
    Stage5Schema,
    makeStage5Fallback(),
    0,
    "stage5",
    async (tokens) => {
      await emit?.({
        documentId: document.document_id,
        userId: document.user_id,
        eventType: "ai_safety_started",
        stage: "AI_PROCESSING",
        message: `Checking for unsupported claims and safety issues (${tokens} chars)`,
        progress: 87 + Math.min(5, Math.floor(tokens / 120)),
        payload: { stage: 5, total: 5, tokens_received: tokens },
      });
    },
    60000,
  );

  const guardrails = buildStage5Guardrails(
    stage3,
    stage4Raw,
    officialSnippets,
    document,
  );
  const stage5: Stage5 = {
    ...stage5Raw,
    issues: [...stage5Raw.issues, ...guardrails.issues],
    final_recommendation:
      stage5Raw.final_recommendation === "block"
        ? "block"
        : guardrails.final_recommendation === "approve" &&
            stage5Raw.final_recommendation === "approve"
          ? "approve"
          : "revise",
  };

  const guardrailDiagnostics = summarizeGuardrailDiagnostics(
    stage1,
    stage2,
    stage3,
    officialSnippets,
    document,
  );
  const humanReviewRequired =
    stage1.needs_human_review ||
    stage3.needs_human_review ||
    stage4Raw.needs_human_review ||
    stage5.final_recommendation !== "approve";

  const humanReviewReason = mergeHumanReviewReason(
    stage1,
    stage3,
    stage4Raw,
    stage5,
    {
      ...guardrailDiagnostics,
      issue_notes: guardrails.issues.map((issue) => issue.description),
    },
  );

  const trustedSources = sanitizeTrustedSources(
    stage4Raw.trusted_sources,
    officialSnippets,
  );
  const summary = enforceUncertaintyLanguage(
    stage4Raw.ai_summary,
    humanReviewRequired,
    humanReviewReason,
  );
  const questions = normalizeQuestions(
    stage4Raw.questions_to_ask,
    humanReviewRequired,
    humanReviewReason,
  );

  const result: DocumentAnalysisPipelineResult = {
    summary,
    action_items: stage4Raw.action_items,
    key_deadlines: stage4Raw.key_deadlines,
    questions_to_ask: questions,
    ai_confidence: stage4Raw.ai_confidence,
    trusted_sources: trustedSources,
    stage_outputs: {
      stage1,
      stage2,
      stage3,
      stage4: {
        ...stage4Raw,
        ai_summary: summary,
        questions_to_ask: questions,
        trusted_sources: trustedSources,
        needs_human_review: humanReviewRequired,
        human_review_reason: humanReviewReason,
      },
      stage5,
      guardrails: {
        ...guardrails,
        official_source_count: officialSnippets.length,
      },
    },
    status: "completed",
  };

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_completed",
    stage: "AI_PROCESSING",
    message: "AI analysis complete",
    progress: 100,
    payload: {
      status: result.status,
      action_item_count: result.action_items.length,
      deadline_count: result.key_deadlines.length,
      trusted_source_count: result.trusted_sources.length,
      official_source_count: officialSnippets.length,
      guardrail_recommendation: stage5.final_recommendation,
    },
  });

  return result;
}
