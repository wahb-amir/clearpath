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

/**
 * Tavily-based official source search
 */
export async function searchOfficialSources(
  query: string,
  options: OfficialSearchOptions = {},
): Promise<OfficialSourceSnippet[]> {
  const apiKey = env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TAVILY_API_KEY");
  }

  const count = Math.min(Math.max(options.count ?? 5, 1), 10);
  const timeoutMs = options.timeoutMs ?? 9000;
  const allowedDomains = options.officialDomains ?? [];

  const body: Record<string, unknown> = {
    query,
    topic: "general",
    max_results: count,
    search_depth: "basic",
    include_answer: false,
    include_raw_content: false
  };

  if (allowedDomains.length > 0) {
    body.include_domains = allowedDomains;
  }

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

  const filtered = results.filter((r) => {
    if (!r.url || !r.title) return false;

    try {
      const host = new URL(r.url).hostname;

      if (allowedDomains.length > 0) {
        return hostnameMatches(host, allowedDomains);
      }

      return isOfficialHostname(host);
    } catch {
      return false;
    }
  });

  const snippets: OfficialSourceSnippet[] = filtered.map((r) => ({
    title: r.title!,
    url: r.url!,
    snippet: normalizeText(r.content ?? ""),
    source: "search_result",
  }));

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