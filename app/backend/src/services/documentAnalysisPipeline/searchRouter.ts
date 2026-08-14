import { z } from "zod";
import { askGroqJsonStreaming } from "./llmClient";
import type { PlannedSearch } from "../officialSourceSearch";
import type { NormalizedDocument } from "../../types/documentAnalysis";
import type { ChatMessage } from "./types";
import type { Stage1, Stage2 } from "./schemas";

/**
 * Schema for the search-router's decision.
 *
 * The router either:
 *   1. Sets `skip_search: true` and provides a `reason`, OR
 *   2. Sets `skip_search: false` and lists 1..N `searches`, each of
 *      which has a `query` and an OPTIONAL `sites` list.
 *
 * `sites` is NOT restricted to .gov/.edu. The model can pick whatever
 * authoritative hostnames it thinks will help (e.g. `ca.gov`,
 * `unhcr.org`, `ed.gov`, `211.org`, `usa.gov`, even a specific state
 * agency site). The downstream orchestrator enforces a hard cap on
 * the number of searches.
 */
export const SearchRouterSchema = z.object({
  skip_search: z.boolean(),
  reason: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1))
    .optional()
    .default(""),
  searches: z
    .array(
      z.object({
        query: z.string().min(1),
        sites: z.array(z.string().min(1)).optional().default([]),
        rationale: z
          .string()
          .transform((v) => v.trim())
          .pipe(z.string().min(1))
          .optional()
          .default(""),
      }),
    )
    .optional()
    .default([]),
});

export type SearchRouterDecision = z.infer<typeof SearchRouterSchema>;

/**
 * Build the prompt the router model sees. We give it the Stage 1
 * topic, Stage 2 extracted items, and the document's first sentence
 * so it can decide whether external search will help, and if so what
 * to look for. We deliberately do NOT pre-list candidate domains —
 * the model picks whatever sites it considers authoritative.
 */
export function buildSearchRouterPrompt(
  document: NormalizedDocument,
  stage1: Stage1,
  stage2: Stage2,
  maxSearches: number,
): ChatMessage[] {
  const sourceText = (document.source_text ?? "").trim();
  const firstSentence = sourceText.split(/[.?!]\s+/)[0]?.slice(0, 280) ?? "";

  return [
    {
      role: "system",
      content:
        "You are ClearPath Search Router. Decide whether this document benefits from web search grounding, and if so what to search for. " +
        "Return strict JSON only. Do not invent facts. If the document is self-contained and doesn't reference outside programs, policies, " +
        "deadlines, or rights, set skip_search=true. If search is useful, list up to " +
        maxSearches +
        " focused queries and optionally pin each to specific sites that would authoritatively answer it (e.g. ['ca.gov', 'ed.gov', 'unhcr.org']). " +
        "Sites are NOT restricted to .gov or .edu — pick whatever hostnames would best answer the query, including nonprofits, agencies, or " +
        "specific state portals. Each query should target one concrete claim that needs verification.",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Decide whether to run web search, and what to search for.",
          document_first_sentence: firstSentence,
          document_type: stage1.document_type,
          primary_topic: stage1.primary_topic,
          intended_audience: stage1.intended_audience,
          needs_human_review: stage1.needs_human_review,
          extracted: {
            deadlines: stage2.deadlines.map((d) => d.text),
            actions: stage2.actions.map((a) => a.text),
            risks: stage2.risks.map((r) => r.text),
            missing_info: stage2.missing_info.map((m) => m.question),
          },
          rules: [
            "skip_search=true when the document is fully self-contained (a personal letter, an internal memo) or the extracted items do not reference outside programs, deadlines, or rights.",
            "skip_search=false when any extracted deadline, action, risk, or contact depends on an external policy, program, or authority.",
            "Each search.query should be 3-10 words. Phrase it like a researcher would search.",
            "search[].sites is OPTIONAL. If provided, list bare hostnames (e.g. ['ca.gov']). An empty list means open-web search.",
            `Produce at most ${maxSearches} searches. Fewer is fine; pick the most important.`,
          ],
          output_shape: {
            skip_search: true,
            reason: "One sentence explaining the decision.",
            searches: [
              {
                query: "Example: California CalFresh recertification deadline 2026",
                sites: ["ca.gov", "calfresh.ca.gov"],
                rationale: "Why this search matters for grounding.",
              },
            ],
          },
        },
        null,
        2,
      ),
    },
  ];
}

/**
 * Call the search router and return a validated decision. If the LLM
 * returns an invalid shape, the repair pass kicks in inside the LLM
 * client; if everything fails we return a conservative fallback that
 * skips search so the rest of the pipeline still runs.
 */
export async function runSearchRouter(
  document: NormalizedDocument,
  stage1: Stage1,
  stage2: Stage2,
  maxSearches: number,
): Promise<SearchRouterDecision> {
  const fallback: SearchRouterDecision = {
    skip_search: true,
    reason:
      "Search router unavailable; defaulting to skip to keep the pipeline moving.",
    searches: [],
  };

  return askGroqJsonStreaming(
    buildSearchRouterPrompt(document, stage1, stage2, maxSearches),
    SearchRouterSchema,
    fallback,
    0,
    "searchRouter",
    undefined,
    20000,
  );
}

/**
 * Convert a router decision into concrete `PlannedSearch` objects that
 * the search client can fan out in parallel. Enforces the per-run
 * cap so a runaway model can't queue 50 queries.
 */
export function decisionToPlans(
  decision: SearchRouterDecision,
  maxSearches: number,
): PlannedSearch[] {
  if (decision.skip_search) return [];

  const plans: PlannedSearch[] = [];

  for (const s of decision.searches ?? []) {
    const query = (s.query ?? "").trim();
    if (!query) continue;
    const sites = (s.sites ?? [])
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    plans.push({ query, sites: sites.length > 0 ? sites : undefined });
    if (plans.length >= maxSearches) break;
  }

  return plans;
}
