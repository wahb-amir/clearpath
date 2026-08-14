import {
  searchMany,
  type OfficialSourceSnippet,
  type PlannedSearch,
} from "../officialSourceSearch";
import type { NormalizedDocument } from "../../types/documentAnalysis";
import type { Stage1, Stage2 } from "./schemas";
import type { PipelineEventEmitter, PipelineOptions } from "./types";
import { buildSourceText } from "./prompts";
import {
  decisionToPlans,
  runSearchRouter,
  type SearchRouterDecision,
} from "./searchRouter";

const DEFAULT_MAX_SEARCHES = 3;

/**
 * Run the official-source grounding step that sits between Stage 2
 * (extraction) and Stage 3 (verification).
 *
 * The flow is:
 *   1. Ask the search router model whether to skip search entirely
 *      and, if not, what queries to run + which sites to scope each
 *      one to. The router is FREE to pick any sites — no .gov/.edu
 *      lock-in.
 *   2. Cap the resulting plan list at `options.maxSearches ?? 3`.
 *   3. Fan the approved plans out to Tavily in PARALLEL via
 *      `searchMany` (which uses Promise.allSettled so one slow
 *      query doesn't block the rest). Open-web searches (no sites
 *      requested) are also supported.
 *   4. Dedupe and clip the merged snippets, then emit SSE events so
 *      the UI can show what was searched and what came back.
 *
 * Returns at most 8 snippets — enough to ground Stage 3 without
 * blowing up the prompt size.
 */
export async function buildOfficialSourceSnippets(
  document: NormalizedDocument,
  stage1: Stage1,
  stage2: Stage2,
  options: PipelineOptions = {},
  emit?: PipelineEventEmitter,
): Promise<OfficialSourceSnippet[]> {
  const maxSearches = Math.max(options.maxSearches ?? DEFAULT_MAX_SEARCHES, 1);
  const maxResultsPerQuery = options.maxSearchResultsPerQuery ?? 5;
  const defaultSites =
    options.defaultSearchSites && options.defaultSearchSites.length > 0
      ? options.defaultSearchSites
      : undefined;

  // ── Router call: should we search at all, and if so what/where? ──
  let decision: SearchRouterDecision;
  try {
    decision = await runSearchRouter(document, stage1, stage2, maxSearches);
  } catch (error) {
    decision = {
      skip_search: true,
      reason:
        "Search router errored; continuing without web search. " +
        (error instanceof Error ? error.message : String(error)),
      searches: [],
    };
  }

  if (decision.skip_search) {
    await emit?.({
      documentId: document.document_id,
      userId: document.user_id,
      eventType: "ai_search_skipped",
      stage: "grounding",
      message: `Search skipped — ${decision.reason || "model decided search is unnecessary"}`,
      progress: 65,
      payload: { reason: decision.reason || "model decided search is unnecessary" },
    });

    await emit?.({
      documentId: document.document_id,
      userId: document.user_id,
      eventType: "ai_search_completed",
      stage: "grounding",
      message: "Grounding step complete (no web search performed)",
      progress: 80,
      payload: { source_count: 0, sources: [] },
    });

    return [];
  }

  // Convert + cap. Apply the default-site fallback only when the
  // router left sites empty for an individual query.
  let plans: PlannedSearch[] = decisionToPlans(decision, maxSearches).map(
    (p) => ({
      ...p,
      sites: p.sites && p.sites.length > 0 ? p.sites : defaultSites,
    }),
  );

  // If the router produced no usable plans but didn't set
  // skip_search, fall back to a single deterministic query so we
  // still get some grounding.
  if (plans.length === 0) {
    const firstSentence = buildSourceText(document)
      .split(/[.?!]\s+/)[0]
      ?.slice(0, 120)
      ?.trim();
    const topic = stage1.primary_topic !== "unclear" ? stage1.primary_topic : "";
    const fallbackQuery = [firstSentence, topic]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (fallbackQuery) {
      plans = [{ query: fallbackQuery, sites: defaultSites }];
    }
  }

  const queries = plans.map((p) => p.query);

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_search_started",
    stage: "grounding",
    message: `Running ${plans.length} parallel web search${plans.length === 1 ? "" : "es"} (cap ${maxSearches})`,
    progress: 60,
    payload: {
      query_count: plans.length,
      max_searches: maxSearches,
      queries,
      plans: plans.map((p) => ({ query: p.query, sites: p.sites ?? [] })),
    },
  });

  // ── Parallel fan-out ──
  // We kick off all queries at once. `searchMany` uses
  // Promise.allSettled under the hood, so a single failure won't
  // take the whole batch down. This is the key change vs the old
  // sequential loop, which could take 30+ seconds when one search
  // timed out.
  const results = await searchMany(plans, {
    defaultMaxResults: maxResultsPerQuery,
  });

  // ── Dedupe + merge, then emit per-query progress events ──
  const snippets: OfficialSourceSnippet[] = [];
  const seen = new Set<string>();
  const add = (s: OfficialSourceSnippet) => {
    const key = `${s.url}::${s.source}`;
    if (seen.has(key)) return;
    seen.add(key);
    snippets.push(s);
  };

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    for (const hit of r.snippets) add(hit);

    await emit?.({
      documentId: document.document_id,
      userId: document.user_id,
      eventType: "ai_search_progress",
      stage: "grounding",
      message: r.error
        ? `Search ${i + 1}/${results.length} failed: ${r.error}`
        : `Search ${i + 1}/${results.length} done — ${r.snippets.length} sources found (${snippets.length} total)`,
      progress: 60 + Math.round(((i + 1) / results.length) * 20),
      payload: {
        query: r.query,
        query_index: i + 1,
        query_total: results.length,
        sites: r.sites ?? [],
        hits_this_query: r.snippets.length,
        total_snippets: snippets.length,
        sources: r.snippets.map((h) => ({ title: h.title, url: h.url })),
        ...(r.error ? { error: r.error } : {}),
      },
    });
  }

  const clipped = dedupeAndClip(snippets, 8);

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_search_completed",
    stage: "grounding",
    message: `Web search complete — ${clipped.length} unique sources collected from ${results.length} quer${results.length === 1 ? "y" : "ies"}`,
    progress: 80,
    payload: {
      source_count: clipped.length,
      query_count: results.length,
      sources: clipped
        .slice(0, 8)
        .map((s) => ({ title: s.title, url: s.url, source: s.source })),
    },
  });

  return clipped;
}

function dedupeAndClip(
  snippets: OfficialSourceSnippet[],
  max: number,
): OfficialSourceSnippet[] {
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
