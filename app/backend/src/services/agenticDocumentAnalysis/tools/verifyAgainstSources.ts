import { z } from "zod";
import {
  askGroqJsonStreaming,
} from "../../documentAnalysisPipeline/llmClient";
import {
  Stage3Schema,
  type Stage3,
} from "../../documentAnalysisPipeline/schemas";
import { makeStage3Fallback } from "../../documentAnalysisPipeline/fallbacks";
import { buildStage3Prompt } from "../../documentAnalysisPipeline/prompts";
import type { AgentTool, AgentToolContext } from "../types";
import type { OfficialSourceSnippet } from "../../officialSourceSearch";

export const VerifyAgainstSourcesParamsSchema = z.object({
  /** Optional inline snippets the model wants grounded against. If omitted,
   *  the run-level `ctx.officialSnippets` (accumulated from web_search) is
   *  used; if that's empty too, Stage 3 falls back to document-text only. */
  snippets: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().min(1),
        snippet: z.string(),
        source: z.enum(["search_result", "page_excerpt"]),
      }),
    )
    .optional(),
});

export interface VerifyAgainstSourcesResult {
  stage3: Stage3;
  snippet_count: number;
  source: "model" | "fallback";
}

export const verifyAgainstSourcesTool: AgentTool<
  "verify_against_sources",
  z.infer<typeof VerifyAgainstSourcesParamsSchema>,
  VerifyAgainstSourcesResult
> = {
  name: "verify_against_sources",
  description:
    "Cross-reference the extracted items against official-source snippets (or document text only when no snippets exist). Returns a Stage-3-shaped object with verified/partially_verified/unverified/conflicting tags. Call this AFTER you have extracted candidates and (optionally) collected web search results.",
  parameters: {
    type: "object",
    properties: {
      snippets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            snippet: { type: "string" },
            source: { type: "string", enum: ["search_result", "page_excerpt"] },
          },
          required: ["title", "url", "snippet", "source"],
        },
      },
    },
  },
  paramsSchema: VerifyAgainstSourcesParamsSchema,
  sseEvent: {
    start: "ai_verification_started",
    complete: "ai_verification_completed",
  },
  handler: async (args, ctx) => {
    const stage2 = ctx.accumulated.stage2;
    if (!stage2) {
      throw new Error(
        "verify_against_sources called before extract_candidates — agent must extract first.",
      );
    }

    const inlineSnippets = args.snippets ?? [];
    const inlineTyped: OfficialSourceSnippet[] = inlineSnippets.map((s) => ({
      title: s.title,
      url: s.url,
      snippet: s.snippet,
      source: s.source,
    }));
    const snippets: OfficialSourceSnippet[] = inlineTyped.length > 0
      ? inlineTyped
      : ctx.officialSnippets;

    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_verification_started",
      stage: "AI_PROCESSING",
      message: `Verifying ${stage2.deadlines.length + stage2.actions.length + stage2.risks.length + stage2.contacts.length} items against ${snippets.length} source snippets`,
      progress: 55,
      payload: {
        stage: 3,
        total: 5,
        sub_step: "verify",
        official_source_count: snippets.length,
      },
    });

    let result: Stage3;
    let source: "model" | "fallback" = "model";
    try {
      result = await askGroqJsonStreaming<Stage3>(
        buildStage3Prompt(ctx.document, stage2, snippets).messages,
        Stage3Schema,
        makeStage3Fallback(),
        ctx.config.temperature,
        "agentic-verify",
        async (tokens) => {
          const p = 55 + Math.min(10, Math.floor(tokens / 200));
          await ctx.emit({
            documentId: ctx.document.document_id,
            userId: ctx.document.user_id,
            eventType: "ai_verification_started",
            stage: "AI_PROCESSING",
            message: `Cross-referencing items (${tokens} chars)`,
            progress: p,
            payload: { stage: 3, total: 5, tokens_received: tokens },
          });
        },
        60000,
      );
    } catch {
      result = makeStage3Fallback();
      source = "fallback";
    }

    ctx.accumulated.stage3 = result;

    const verifiedCount = result.verified_items.filter(
      (i) => i.status === "verified",
    ).length;

    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_verification_completed",
      stage: "AI_PROCESSING",
      message: `Verification complete — ${verifiedCount} verified (confidence ${Math.round(result.overall_confidence * 100)}%)`,
      progress: 68,
      payload: {
        stage: 3,
        total: 5,
        verified_count: verifiedCount,
        partial_count: result.verified_items.filter(
          (i) => i.status === "partially_verified",
        ).length,
        unverified_count: result.verified_items.filter(
          (i) => i.status === "unverified",
        ).length,
        conflicting_count: result.verified_items.filter(
          (i) => i.status === "conflicting",
        ).length,
        overall_confidence: result.overall_confidence,
        needs_human_review: result.needs_human_review,
        source,
      },
    });

    return { stage3: result, snippet_count: snippets.length, source };
  },
};
