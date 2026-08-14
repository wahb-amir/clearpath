import { env } from "../config/env";

export interface OfficialSourceSnippet {
  title: string;
  url: string;
  snippet: string;
  source: "search_result" | "page_excerpt";
}

export interface OfficialSearchOptions {
  count?: number;
  /**
   * If provided, Tavily's results will be restricted to these domains
   * (e.g. `["ca.gov", "ed.gov"]`). When omitted, NO domain restriction
   * is applied — the model-driven search stage is free to surface any
   * site it considers useful. Trust filtering for `trusted_sources`
   * happens separately via `isTrustedOfficialUrl`.
   */
  officialDomains?: string[];
  timeoutMs?: number;
}

export interface PlannedSearch {
  /** Human-readable query string. */
  query: string;
  /**
   * Optional list of hostnames the model wants to scope the search to
   * (e.g. `["ca.gov"]`). Empty/undefined means "any site".
   */
  sites?: string[];
  /**
   * Per-query override for how many results to fetch. Falls back to
   * the orchestrator-level default.
   */
  maxResults?: number;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilySearchResponse {
  results?: TavilyResult[];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isOfficialHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower.endsWith(".gov") || lower.endsWith(".edu");
}

function hostnameMatches(hostname: string, allowedDomains: string[]): boolean {
  const lowerHost = hostname.toLowerCase();
  return allowedDomains.some((domain) => {
    const allowed = domain.toLowerCase().replace(/^https?:\/\//, "");
    return lowerHost === allowed || lowerHost.endsWith(`.${allowed}`);
  });
}

function dedupeSnippets(
  snippets: OfficialSourceSnippet[],
): OfficialSourceSnippet[] {
  const seen = new Set<string>();
  const out: OfficialSourceSnippet[] = [];

  for (const s of snippets) {
    const key = `${s.url}::${s.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }

  return out;
}

async function fetchPageExcerpt(
  url: string,
  timeoutMs = 9000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ClearPath/1.0; +https://example.invalid)",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed ${url}: ${res.status}`);
    }

    const html = await res.text();

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ");

    return normalizeText(text).slice(0, 1300);
  } finally {
    clearTimeout(timer);
  }
}

function buildTavilyBody(
  query: string,
  count: number,
  sites: string[] | undefined,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    query,
    topic: "general",
    max_results: count,
    search_depth: "basic",
    include_answer: false,
    include_raw_content: false,
  };

  // Only restrict domains when the model explicitly asked for it.
  // An empty / undefined list means "search the open web".
  if (sites && sites.length > 0) {
    body.include_domains = sites;
  }

  return body;
}

/**
 * Internal: run a single Tavily query and return snippets scoped to the
 * model's requested sites (or the open web if none were requested).
 *
 * NOTE: Unlike the previous version this function does NOT filter
 * results to `.gov`/`.edu` when no sites are passed — the model
 * decides which domains are relevant. Callers that need a trust gate
 * (e.g. `sanitizeTrustedSources`) should apply `isTrustedOfficialUrl`.
 */
async function runTavilyQuery(
  query: string,
  count: number,
  sites: string[] | undefined,
): Promise<OfficialSourceSnippet[]> {
  const apiKey = env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TAVILY_API_KEY");
  }

  const body = buildTavilyBody(query, count, sites);

  console.log("TAVILY REQUEST:", JSON.stringify(body, null, 2));

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    console.error("TAVILY ERROR:", err);

    throw new Error(
      `Official source search failed (${response.status}): ${err.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as TavilySearchResponse;
  const results = data.results ?? [];

  return results
    .filter((r): r is Required<Pick<TavilyResult, "title" | "url">> & TavilyResult =>
      Boolean(r.url && r.title),
    )
    .map((r) => ({
      title: r.title,
      url: r.url,
      snippet: normalizeText(r.content ?? ""),
      source: "search_result" as const,
    }));
}

/**
 * Backwards-compatible single-query search. When the caller passes
 * `officialDomains`, the request is scoped to those domains. When they
 * do not, results come from the open web (no `.gov`/`.edu` filter).
 */
export async function searchOfficialSources(
  query: string,
  options: OfficialSearchOptions = {},
): Promise<OfficialSourceSnippet[]> {
  const count = Math.min(Math.max(options.count ?? 5, 1), 10);
  const timeoutMs = options.timeoutMs ?? 9000;

  const snippets = await runTavilyQuery(query, count, options.officialDomains);

  // Only filter to .gov/.edu when the caller asked for an explicit
  // official-domain list. With no list, the open-web results stand.
  if (options.officialDomains && options.officialDomains.length > 0) {
    const allowed = new Set<string>();
    for (const s of snippets) {
      try {
        const host = new URL(s.url).hostname;
        if (hostnameMatches(host, options.officialDomains)) allowed.add(`${s.url}::${s.source}`);
      } catch {
        /* ignore */
      }
    }
    return snippets.filter((s) => allowed.has(`${s.url}::${s.source}`));
  }

  const excerptTargets = snippets.slice(0, 3);

  for (const t of excerptTargets) {
    try {
      const excerpt = await fetchPageExcerpt(t.url, timeoutMs);
      if (excerpt) {
        snippets.push({
          title: t.title,
          url: t.url,
          snippet: excerpt,
          source: "page_excerpt",
        });
      }
    } catch {
      // ignore
    }
  }

  return dedupeSnippets(snippets).slice(0, 8);
}

export interface SearchManyOptions {
  /** Default per-query result count when a planned search doesn't override. */
  defaultMaxResults?: number;
  timeoutMs?: number;
}

export interface SearchManyResult {
  query: string;
  sites?: string[];
  snippets: OfficialSourceSnippet[];
  error?: string;
}

/**
 * Run many Tavily queries in parallel. Each planned search can carry
 * its own `sites` and `maxResults`; the orchestrator decides the cap.
 *
 * Uses `Promise.allSettled` so a single failing query doesn't take the
 * whole batch down — common cause of "async request takes a lot of
 * time" complaints when one slow host blocks the rest of the run.
 */
export async function searchMany(
  plans: PlannedSearch[],
  options: SearchManyOptions = {},
): Promise<SearchManyResult[]> {
  const defaultMax = options.defaultMaxResults ?? 5;

  const settled = await Promise.allSettled(
    plans.map(async (plan): Promise<SearchManyResult> => {
      const count = Math.min(Math.max(plan.maxResults ?? defaultMax, 1), 10);
      const snippets = await searchOfficialSources(plan.query, {
        count,
        officialDomains: plan.sites && plan.sites.length > 0 ? plan.sites : undefined,
        timeoutMs: options.timeoutMs,
      });
      return { query: plan.query, sites: plan.sites, snippets };
    }),
  );

  return settled.map((outcome, i) => {
    const plan = plans[i];
    if (outcome.status === "fulfilled") return outcome.value;
    const reason =
      outcome.reason instanceof Error
        ? outcome.reason.message
        : String(outcome.reason);
    return {
      query: plan.query,
      sites: plan.sites,
      snippets: [],
      error: reason,
    };
  });
}

export function isTrustedOfficialUrl(
  url: string,
  allowlist: string[] = [],
): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();

    if (allowlist.length > 0) {
      return hostnameMatches(host, allowlist);
    }

    return isOfficialHostname(host);
  } catch {
    return false;
  }
}
