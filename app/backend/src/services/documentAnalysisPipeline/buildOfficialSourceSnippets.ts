import {
  searchOfficialSources,
  type OfficialSourceSnippet,
} from "../officialSourceSearch";
import type { NormalizedDocument } from "../../types/documentAnalysis";
import type { Stage1, Stage2 } from "./schemas";
import type { PipelineEventEmitter, PipelineOptions } from "./types";
import { buildSourceText } from "./prompts";

/**
 * Run the official-source search step that sits between Stage 2
 * (extraction) and Stage 3 (verification).
 *
 * Builds a small list of search queries from Stage 1's topic and
 * Stage 2's extracted deadlines / actions / risks, then runs each
 * query against the Tavily-backed `searchOfficialSources` client and
 * dedupes the results. Emits ai_search_* events so the SSE feed
 * surfaces progress.
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
  const snippets: OfficialSourceSnippet[] = [];

  // ✅ Fixed: Prevent "unclear" from generating a wasted search query
  const rawQueries = [
    stage1.primary_topic !== "unclear" ? stage1.primary_topic : "",
    ...stage2.deadlines.map((d) => d.text),
    ...stage2.actions.map((a) => a.text),
    ...stage2.risks.map((r) => r.text),
  ]
    .filter((q): q is string => Boolean(q && q.trim()))
    .map((q) => q.trim());

  const firstSentence = buildSourceText(document)
    .split(/[.?!]\s+/)[0]
    ?.slice(0, 120)
    ?.trim();

  if (firstSentence) {
    rawQueries.unshift(`${firstSentence} official`);
  }

  const queries = [...new Set(rawQueries)].filter(Boolean).slice(0, 8);

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_search_started",
    stage: "grounding",
    message: `Searching ${queries.length} queries against official sources (.gov / .edu)`,
    progress: 60,
    payload: { query_count: queries.length, queries },
  });

  const total = Math.max(queries.length, 1);

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    await emit?.({
      documentId: document.document_id,
      userId: document.user_id,
      eventType: "ai_search_progress",
      stage: "grounding",
      message: `Search ${i + 1}/${queries.length}: "${query}"`,
      progress: 60 + Math.round((i / total) * 20),
      payload: { query, query_index: i + 1, query_total: queries.length },
    });

    try {
      const hits = await searchOfficialSources(query, {
        count: options.maxSearchResultsPerQuery ?? 5,
        officialDomains: options.officialDomains,
      });

      if (hits.length > 0) {
        const seen = new Set(snippets.map((s) => `${s.url}::${s.source}`));
        for (const hit of hits) {
          const key = `${hit.url}::${hit.source}`;
          if (seen.has(key)) continue;
          seen.add(key);
          snippets.push(hit);
        }
      }

      await emit?.({
        documentId: document.document_id,
        userId: document.user_id,
        eventType: "ai_search_progress",
        stage: "grounding",
        message: `Search ${i + 1}/${queries.length} done — ${hits.length} sources found (${snippets.length} total)`,
        progress: 65 + Math.round((i / total) * 15),
        payload: {
          query,
          query_index: i + 1,
          query_total: queries.length,
          hits_this_query: hits.length,
          total_snippets: snippets.length,
          sources: hits.map((h) => ({ title: h.title, url: h.url })),
        },
      });
    } catch (error) {
      await emit?.({
        documentId: document.document_id,
        userId: document.user_id,
        eventType: "ai_search_progress",
        stage: "grounding",
        message: `Search ${i + 1}/${queries.length} failed: ${error instanceof Error ? error.message : String(error)}`,
        progress: 65 + Math.round((i / total) * 15),
        payload: {
          query,
          query_index: i + 1,
          query_total: queries.length,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_search_completed",
    stage: "grounding",
    message: `Official source search complete — ${snippets.length} unique sources collected`,
    progress: 80,
    payload: {
      source_count: snippets.length,
      sources: snippets
        .slice(0, 8)
        .map((s) => ({ title: s.title, url: s.url, source: s.source })),
    },
  });

  return snippets.slice(0, 8);
}
