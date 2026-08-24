import { z } from "zod";
import { searchMany, type OfficialSourceSnippet } from "../../officialSourceSearch";
import type { AgentTool, AgentToolContext } from "../types";

export const WebSearchPlanSchema = z.object({
  query: z.string().min(3).max(200),
  sites: z.array(z.string()).max(10).optional(),
  maxResults: z.number().int().min(1).max(10).optional(),
});

export const WebSearchParamsSchema = z.object({
  plans: z.array(WebSearchPlanSchema).min(1).max(3),
});

export interface WebSearchHit {
  query: string;
  snippets: OfficialSourceSnippet[];
  error?: string;
}

export interface WebSearchResult {
  plans: WebSearchHit[];
  merged_snippets: OfficialSourceSnippet[];
  source_count: number;
}

const MAX_SNIPPETS = 8;

function dedupeAndClip(snippets: OfficialSourceSnippet[], max: number): OfficialSourceSnippet[] {
  const seen = new Set<string>();
  const out: OfficialSourceSnippet[] = [];
  for (const s of snippets) {
    const key = `${s.url}::${s.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export const webSearchTool: AgentTool<
  "web_search",
  z.infer<typeof WebSearchParamsSchema>,
  WebSearchResult
> = {
  name: "web_search",
  description:
    "Run up to 3 parallel Tavily web searches and return official-source-style snippets. Use this when you need to ground a claim against external authorities (state portals, federal agencies, legal-aid, etc). Returns deduplicated snippets capped at 8.",
  parameters: {
    type: "object",
    properties: {
      plans: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            query: { type: "string", minLength: 3, maxLength: 200 },
            sites: { type: "array", items: { type: "string" }, maxItems: 10 },
            maxResults: { type: "integer", minimum: 1, maximum: 10 },
          },
          required: ["query"],
        },
      },
    },
    required: ["plans"],
  },
  paramsSchema: WebSearchParamsSchema,
  sseEvent: {
    start: "ai_search_started",
    complete: "ai_search_completed",
  },
  handler: async (args, ctx) => {
    const cap = Math.min(args.plans.length, ctx.config.maxTavilyQueries);
    const plans = args.plans.slice(0, cap);

    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_search_started",
      stage: "grounding",
      message: `Running ${plans.length} parallel web search${plans.length === 1 ? "" : "es"}`,
      progress: 55,
      payload: {
        query_count: plans.length,
        max_searches: ctx.config.maxTavilyQueries,
        queries: plans.map((p) => p.query),
        plans: plans.map((p) => ({ query: p.query, sites: p.sites ?? [] })),
      },
    });

    const results = await searchMany(plans, { defaultMaxResults: 5 });

    const merged: OfficialSourceSnippet[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      for (const hit of r.snippets) merged.push(hit);
      await ctx.emit({
        documentId: ctx.document.document_id,
        userId: ctx.document.user_id,
        eventType: "ai_search_progress",
        stage: "grounding",
        message: r.error
          ? `Search ${i + 1}/${results.length} failed: ${r.error}`
          : `Search ${i + 1}/${results.length} done — ${r.snippets.length} sources found`,
        progress: 55 + Math.round(((i + 1) / results.length) * 10),
        payload: {
          query: r.query,
          query_index: i + 1,
          query_total: results.length,
          sites: r.sites ?? [],
          hits_this_query: r.snippets.length,
          total_snippets: merged.length,
          ...(r.error ? { error: r.error } : {}),
        },
      });
    }

    const clipped = dedupeAndClip(merged, MAX_SNIPPETS);
    // Accumulate into run-level snippet set so finalize() can sanitize trusted_sources.
    for (const s of clipped) {
      ctx.officialSnippets.push(s);
    }

    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_search_completed",
      stage: "grounding",
      message: `Web search complete — ${clipped.length} unique sources collected`,
      progress: 65,
      payload: {
        source_count: clipped.length,
        query_count: results.length,
        sources: clipped.map((s) => ({ title: s.title, url: s.url, source: s.source })),
      },
    });

    return {
      plans: results.map((r) => ({
        query: r.query,
        snippets: r.snippets,
        ...(r.error ? { error: r.error } : {}),
      })),
      merged_snippets: clipped,
      source_count: clipped.length,
    };
  },
};
