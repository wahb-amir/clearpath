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

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveResult[];
  };
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

function dedupeSnippets(snippets: OfficialSourceSnippet[]): OfficialSourceSnippet[] {
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

async function fetchPageExcerpt(url: string, timeoutMs = 9000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ClearPath/1.0; +https://example.invalid)"
      }
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
 * Fetch-based real web search adapter for the grounding stage.
 *
 * The pipeline uses this to gather short official snippets, then feeds those
 * snippets into the verifier prompt. Search is intentionally filtered toward
 * authoritative sources (.gov / .edu or a caller-provided allowlist).
 */
export async function searchOfficialSources(
  query: string,
  options: OfficialSearchOptions = {}
): Promise<OfficialSourceSnippet[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing BRAVE_SEARCH_API_KEY. Configure a web search provider before enabling Stage 3 grounding."
    );
  }

  const count = Math.min(Math.max(options.count ?? 5, 1), 10);
  const language = options.language ?? "en";
  const timeoutMs = options.timeoutMs ?? 9000;

  const params = new URLSearchParams({
    q: query,
    count: String(count),
    search_lang: language
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Official source search failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as BraveSearchResponse;
  const results = data.web?.results ?? [];

  const allowedDomains = options.officialDomains?.filter(Boolean) ?? [];
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
      snippet: normalizeText(result.description ?? ""),
      source: "search_result"
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
          source: "page_excerpt"
        });
      }
    } catch {
      // Keep the search result even if the page blocks fetch.
    }
  }

  return dedupeSnippets(snippets).slice(0, 8);
}

export function isTrustedOfficialUrl(url: string, allowlist: string[] = []): boolean {
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
