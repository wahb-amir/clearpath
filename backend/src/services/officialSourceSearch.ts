import { env } from "../config/env";
export interface OfficialSourceSnippet {
  title: string;
  url: string;
  snippet: string;
  source: "search_result" | "page_excerpt";
}

export interface OfficialSearchOptions {
  count?: number;
  officialDomains?: string[];
  language?: string;
  timeoutMs?: number;
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
  const deduped: OfficialSourceSnippet[] = [];

  for (const snippet of snippets) {
    const key = `${snippet.url}::${snippet.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(snippet);
  }

  return deduped;
}

async function fetchPageExcerpt(
  url: string,
  timeoutMs = 9000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ClearPath/1.0; +https://example.invalid)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const html = await response.text();
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

/**
 * Drop-in replacement for the old Brave-based adapter.
 *
 * Uses Tavily Search API, which has a free plan and returns
 * title/url/content fields that fit this pipeline well.
 */
export async function searchOfficialSources(
  query: string,
  options: OfficialSearchOptions = {},
): Promise<OfficialSourceSnippet[]> {
  const apiKey = env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing TAVILY_API_KEY. Configure Tavily before enabling Stage 3 grounding.",
    );
  }

  const count = Math.min(Math.max(options.count ?? 5, 1), 10);
  const language = options.language ?? "en";
  const timeoutMs = options.timeoutMs ?? 9000;
  const allowedDomains = options.officialDomains?.filter(Boolean) ?? [];

  const body: Record<string, unknown> = {
    query,
    max_results: count,
    search_depth: "basic",
    include_answer: false,
    include_raw_content: false,
  };

  if (language) {
    body["country"] = language;
  }

  if (allowedDomains.length > 0) {
    body["include_domains"] = allowedDomains;
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      ...body,
      country: "united states",
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `Official source search failed (${response.status}): ${errBody.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as TavilySearchResponse;
  const results = data.results ?? [];

  const filtered = results.filter((result) => {
    if (!result.url || !result.title) return false;

    try {
      const hostname = new URL(result.url).hostname;
      if (allowedDomains.length > 0) {
        return hostnameMatches(hostname, allowedDomains);
      }
      return isOfficialHostname(hostname);
    } catch {
      return false;
    }
  });

  const snippets: OfficialSourceSnippet[] = [];
  for (const result of filtered) {
    if (!result.url || !result.title) continue;

    snippets.push({
      title: result.title,
      url: result.url,
      snippet: normalizeText(result.content ?? ""),
      source: "search_result",
    });
  }

  const excerptTargets = snippets.slice(0, Math.min(3, snippets.length));
  for (const target of excerptTargets) {
    try {
      const excerpt = await fetchPageExcerpt(target.url, timeoutMs);
      if (excerpt) {
        snippets.push({
          title: target.title,
          url: target.url,
          snippet: excerpt,
          source: "page_excerpt",
        });
      }
    } catch {
      // Keep the search result even if the page blocks fetch.
    }
  }

  return dedupeSnippets(snippets).slice(0, 8);
}

export function isTrustedOfficialUrl(
  url: string,
  allowlist: string[] = [],
): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (allowlist.length > 0) {
      return hostnameMatches(hostname, allowlist);
    }
    return isOfficialHostname(hostname);
  } catch {
    return false;
  }
}
