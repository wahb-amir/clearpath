import { z } from "zod";
import { Stage4Schema, type Stage4 } from "../../documentAnalysisPipeline/schemas";
import type { AgentTool, AgentToolContext, FinalPayload } from "../types";

/**
 * Stage 4 schema reused as the finalize-tool parameter schema. The
 * agent must produce this exact shape — Zod validates before the loop
 * accepts the tool call.
 */
export const FinalizeParamsSchema = Stage4Schema;

export const finalizeTool: AgentTool<
  "finalize",
  Stage4,
  FinalPayload
> = {
  name: "finalize",
  description:
    "Terminal step. Submit your user-facing synthesis: plain-language summary, action items, key deadlines, suggested questions, confidence breakdown, and trusted sources. The shape must match Stage 4 exactly. After you call this tool, the run ends.",
  parameters: {
    type: "object",
    properties: {
      ai_summary: { type: "string" },
      action_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            supporting_evidence: { type: "string" },
            completed: { type: "boolean" },
          },
          required: ["text", "priority", "supporting_evidence", "completed"],
        },
      },
      key_deadlines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            meaning: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            supporting_evidence: { type: "string" },
          },
          required: ["text", "meaning", "priority", "supporting_evidence"],
        },
      },
      questions_to_ask: { type: "array", items: { type: "string" } },
      ai_confidence: {
        type: "object",
        properties: {
          overall: { type: "number" },
          summary: { type: "number" },
          actions: { type: "number" },
          deadlines: { type: "number" },
          questions: { type: "number" },
        },
      },
      trusted_sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            why_it_matters: { type: "string" },
          },
          required: ["title", "url", "why_it_matters"],
        },
      },
      needs_human_review: { type: "boolean" },
      human_review_reason: { type: "string" },
    },
    required: [
      "ai_summary",
      "action_items",
      "key_deadlines",
      "questions_to_ask",
      "ai_confidence",
      "trusted_sources",
      "needs_human_review",
      "human_review_reason",
    ],
  },
  paramsSchema: FinalizeParamsSchema,
  sseEvent: {
    start: "ai_synthesis_started",
    complete: "ai_synthesis_completed",
  },
  terminal: true,
  handler: async (args, ctx) => {
    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_synthesis_started",
      stage: "AI_PROCESSING",
      message: "Writing user-facing summary",
      progress: 70,
      payload: {
        stage: 4,
        total: 5,
        action_item_count: args.action_items.length,
        deadline_count: args.key_deadlines.length,
      },
    });

    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_summary_delta",
      stage: "AI_PROCESSING",
      message: `Synthesis complete — ${args.action_items.length} actions, ${args.key_deadlines.length} deadlines`,
      progress: 85,
      payload: {
        stage: 4,
        total: 5,
        action_item_count: args.action_items.length,
        deadline_count: args.key_deadlines.length,
        question_count: args.questions_to_ask.length,
        trusted_source_count: args.trusted_sources.length,
        ai_confidence: args.ai_confidence,
      },
    });

    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_synthesis_completed",
      stage: "AI_PROCESSING",
      message: "Synthesis finalized",
      progress: 87,
      payload: { stage: 4, total: 5 },
    });

    return {
      stage4: args,
      officialSnippets: [...ctx.officialSnippets],
      notes: undefined,
    };
  },
};
