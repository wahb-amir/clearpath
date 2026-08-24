import { z } from "zod";
import {
  askGroqJsonStreaming,
} from "../../documentAnalysisPipeline/llmClient";
import {
  Stage2Schema,
  type Stage2,
} from "../../documentAnalysisPipeline/schemas";
import { makeStage2Fallback } from "../../documentAnalysisPipeline/fallbacks";
import { buildStage2Prompt } from "../../documentAnalysisPipeline/prompts";
import { makeStage1Fallback } from "../../documentAnalysisPipeline/fallbacks";
import type { AgentTool, AgentToolContext } from "../types";

export const ExtractCandidatesParamsSchema = z.object({
  hint: z
    .string()
    .max(500)
    .optional()
    .describe("Optional steering — e.g. 'focus on appeal deadlines'."),
});

export interface ExtractCandidatesResult {
  stage2: Stage2;
  source: "model" | "fallback";
}

export const extractCandidatesTool: AgentTool<
  "extract_candidates",
  z.infer<typeof ExtractCandidatesParamsSchema>,
  ExtractCandidatesResult
> = {
  name: "extract_candidates",
  description:
    "Extract concrete deadlines, actions, risks, contacts, and missing information from the document. Returns a Stage-2-shaped JSON object. Use this once you have enough understanding of the document's content.",
  parameters: {
    type: "object",
    properties: {
      hint: { type: "string", maxLength: 500 },
    },
  },
  paramsSchema: ExtractCandidatesParamsSchema,
  sseEvent: {
    start: "ai_extraction_started",
    complete: "ai_extraction_completed",
  },
  handler: async (args, ctx) => {
    // We don't expose Stage 1 to the agent — synthesize a minimal one so
    // buildStage2Prompt (which expects a stage1 argument) works.
    const stage1 =
      (ctx.accumulated as { stage1?: import("../../documentAnalysisPipeline/schemas").Stage1 }).stage1
        ?? makeStage1Fallback(ctx.document);

    let emittedTokens = 0;
    let lastEmittedProgress = 22;

    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_extraction_started",
      stage: "AI_PROCESSING",
      message: "Extracting deadlines, actions, risks, and contacts",
      progress: 22,
      payload: { stage: 2, total: 5 },
    });

    let result: Stage2;
    let source: "model" | "fallback" = "model";
    try {
      const stage2 = await askGroqJsonStreaming<Stage2>(
        [
          ...buildStage2Prompt(ctx.document, stage1),
          // Append the model's optional hint as a developer nudge.
          ...(args.hint
            ? [
                {
                  role: "user" as const,
                  content: `Additional focus from the agent: ${args.hint}`,
                },
              ]
            : []),
        ],
        Stage2Schema,
        makeStage2Fallback(),
        ctx.config.temperature,
        "agentic-extract",
        async (tokens, partial) => {
          emittedTokens = tokens;
          // Map the tool's internal progress to ~22-35% window.
          const p = 22 + Math.min(13, Math.floor(tokens / 200));
          if (p !== lastEmittedProgress) {
            lastEmittedProgress = p;
            await ctx.emit({
              documentId: ctx.document.document_id,
              userId: ctx.document.user_id,
              eventType: "ai_extraction_started",
              stage: "AI_PROCESSING",
              message: `Extracting candidates (${tokens} chars)`,
              progress: p,
              payload: { stage: 2, total: 5, partial_chars: partial.length },
            });
          }
        },
      );
      result = stage2;
    } catch {
      result = makeStage2Fallback();
      source = "fallback";
    }

    ctx.accumulated.stage2 = result;

    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_extraction_completed",
      stage: "AI_PROCESSING",
      message: `Extraction complete — ${result.deadlines.length} deadlines, ${result.actions.length} actions, ${result.risks.length} risks, ${result.contacts.length} contacts`,
      progress: 35,
      payload: {
        stage: 2,
        total: 5,
        deadline_count: result.deadlines.length,
        action_count: result.actions.length,
        risk_count: result.risks.length,
        contact_count: result.contacts.length,
        source,
      },
    });

    return { stage2: result, source };
  },
};
