/**
 * Token-budget helpers for the ClearPath pipeline.
 *
 * The free-tier Groq model we target (`openai/gpt-oss-120b`) has an
 * 8 000 tokens-per-minute ceiling on `on_demand`. The pipeline can
 * ship large payloads (a multi-page PDF flattened to `source_text`,
 * plus every official-source snippet, plus the JSON envelope) — that
 * blew past 8 899 tokens on a real run and crashed Stage 3 with
 * `APIError: 413 … Request too large`.
 *
 * This module gives us a cheap pre-flight estimate (no real tokenizer
 * in the bundle) plus a pair of trim helpers that shrink the payload
 * BEFORE the HTTP request goes out. We deliberately bias toward
 * under-trimming rather than over-trimming so the model still has
 * enough signal to verify; the trims only kick in when we'd otherwise
 * blow the budget.
 *
 * Constants live here so stage callers and the LLM client share one
 * source of truth.
 */

import type { OfficialSourceSnippet } from "../officialSourceSearch";

/** The model's per-minute ceiling. Keep headroom for output tokens. */
export const GROQ_TPM_LIMIT = 8000;

/** Worst-case output reserve per stage call (Stage 4 is the heaviest). */
export const GROQ_OUTPUT_RESERVE_TOKENS = 1500;

/** Safe input budget we should stay under when staging the request. */
export const SAFE_INPUT_TOKEN_BUDGET = GROQ_TPM_LIMIT - GROQ_OUTPUT_RESERVE_TOKENS;

/**
 * English prose averages ~4 chars per token. Code + JSON + quoted URLs
 * skew a bit higher (closer to 3 chars/token) so we use 3.5 as a
 * conservative middle ground. We only need this to be roughly right
 * — the goal is "don't blow past 8000," not "predict exact billable
 * tokens."
 */
const CHARS_PER_TOKEN = 3.5;

export function estimateTokensFromChars(chars: number): number {
  if (chars <= 0) return 0;
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

export function estimateMessageTokens(text: string): number {
  // Add 4 tokens of per-message overhead for the OpenAI chat format
  // (role/name framing). It won't make or break the budget but it
  // keeps multi-message prompts honest.
  return estimateTokensFromChars(text.length) + 4;
}

export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>,
): number {
  let total = 0;
  for (const message of messages) {
    total += estimateMessageTokens(message.content ?? "");
  }
  return total;
}

/**
 * Cap a free-form string at roughly `maxTokens` tokens. If we have to
 * cut, we keep the head and tail and insert an ellipsis marker so the
 * model can see what was dropped.
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  if (!text) return text;
  const maxChars = Math.max(0, Math.floor(maxTokens * CHARS_PER_TOKEN));
  if (text.length <= maxChars) return text;

  // Keep head + tail; mark the middle as truncated. Bias toward the
  // head (where context usually lives) and grab a smaller tail so we
  // preserve trailing dates / numbers / contact info.
  const headChars = Math.floor(maxChars * 0.7);
  const tailChars = Math.max(0, maxChars - headChars - 80);
  const head = text.slice(0, headChars);
  const tail = tailChars > 0 ? text.slice(text.length - tailChars) : "";
  const omitted = text.length - head.length - tail.length;
  return `${head}\n\n… [truncated ${omitted} characters to fit token budget] …\n\n${tail}`;
}

/**
 * Trim a Stage 3 payload down to fit under `maxInputTokens`.
 *
 * Strategy:
 *   1. Reserve room for the system + user envelope + verified_items.
 *   2. If we're still over budget, shrink official_source_snippets
 *      (each kept to title + first ~400 chars of snippet text).
 *   3. Last resort: shrink document_text to the configured cap and
 *      flag the trim in the prompt so the model knows it.
 *
 * The function is intentionally side-effect free — it returns a
 * fresh payload object so callers can still log the original.
 */
export interface Stage3Payload {
  document_text: string;
  extracted_items: unknown;
  official_source_snippets: OfficialSourceSnippet[];
}

export interface Stage3TrimReport {
  document_truncated: boolean;
  document_original_chars: number;
  document_kept_chars: number;
  snippets_trimmed: number;
  snippets_dropped: number;
  estimated_input_tokens: number;
}

const ENVELOPE_OVERHEAD_TOKENS = 350; // system prompt + JSON keys + verified_items

/**
 * Compact a snippet to `title` + first N chars of `snippet`. The model
 * can usually verify a claim from the lead sentence + URL.
 */
export function compactSnippet(
  snippet: OfficialSourceSnippet,
  maxSnippetChars = 400,
): OfficialSourceSnippet {
  const trimmed = (snippet.snippet ?? "").slice(0, maxSnippetChars).trimEnd();
  return {
    title: snippet.title,
    url: snippet.url,
    snippet: trimmed + (snippet.snippet && snippet.snippet.length > maxSnippetChars ? "…" : ""),
    source: snippet.source,
  };
}

/**
 * Decide whether the payload needs trimming. Returns the (possibly
 * trimmed) payload plus a diagnostic report so the caller can log
 * what happened.
 */
export function fitStage3Payload(
  payload: Stage3Payload,
  maxInputTokens = SAFE_INPUT_TOKEN_BUDGET,
): { payload: Stage3Payload; report: Stage3TrimReport } {
  // 1. Measure current size — only the user-side content. We approximate
  //    extracted_items by its JSON length; the schema is small enough
  //    that this is fine.
  const extractedJson = JSON.stringify(payload.extracted_items ?? {});
  const report: Stage3TrimReport = {
    document_truncated: false,
    document_original_chars: payload.document_text?.length ?? 0,
    document_kept_chars: payload.document_text?.length ?? 0,
    snippets_trimmed: 0,
    snippets_dropped: 0,
    estimated_input_tokens: 0,
  };

  const recompute = (
    doc: string,
    snippets: OfficialSourceSnippet[],
  ): number => {
    const snippetsJson = JSON.stringify(snippets);
    const totalChars =
      (doc?.length ?? 0) + extractedJson.length + snippetsJson.length;
    return ENVELOPE_OVERHEAD_TOKENS + estimateTokensFromChars(totalChars);
  };

  let document = payload.document_text ?? "";
  let snippets = payload.official_source_snippets ?? [];

  report.estimated_input_tokens = recompute(document, snippets);

  if (report.estimated_input_tokens <= maxInputTokens) {
    return { payload, report };
  }

  // 2. Trim snippets first — they're the most expendable.
  const originalSnippetCount = snippets.length;
  snippets = snippets.map((s) => compactSnippet(s, 400));
  report.snippets_trimmed = originalSnippetCount;
  report.estimated_input_tokens = recompute(document, snippets);

  // 3. If still over budget, drop the lowest-priority snippets. We
  //    keep the first ones (the search router orders them by relevance
  //    to the extracted items in practice).
  if (report.estimated_input_tokens > maxInputTokens) {
    const overshoot = report.estimated_input_tokens - maxInputTokens;
    // Each dropped snippet saves roughly `estimateTokensFromChars(snippetLength)` —
    // assume 250 chars after compact = ~70 tokens.
    const dropCount = Math.min(
      snippets.length,
      Math.ceil(overshoot / 70) + 1,
    );
    snippets = snippets.slice(0, Math.max(0, snippets.length - dropCount));
    report.snippets_dropped = dropCount;
    report.estimated_input_tokens = recompute(document, snippets);
  }

  // 4. Last resort — truncate the document text. Cap to the remaining
  //    budget minus envelope.
  if (report.estimated_input_tokens > maxInputTokens) {
    const remaining = maxInputTokens - ENVELOPE_OVERHEAD_TOKENS;
    const docBudget = Math.max(400, remaining - estimateTokensFromChars(JSON.stringify(snippets).length));
    const truncated = truncateToTokenBudget(document, docBudget);
    if (truncated.length < document.length) {
      report.document_truncated = true;
      report.document_original_chars = document.length;
      report.document_kept_chars = truncated.length;
    }
    document = truncated;
    report.estimated_input_tokens = recompute(document, snippets);
  }

  return {
    payload: {
      document_text: document,
      extracted_items: payload.extracted_items,
      official_source_snippets: snippets,
    },
    report,
  };
}

/**
 * Generic pre-flight for ANY chat-completion payload. Returns the
 * (possibly trimmed) user-message JSON and a report. The LLM client
 * calls this before firing the HTTP request so we never see a 413
 * for inputs we could have caught.
 */
export function fitMessagesToBudget<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  options: {
    maxInputTokens?: number;
    /** Field whose value is a long string we can truncate. */
    textFields?: ReadonlyArray<keyof TPayload>;
    /** Field whose value is an array we can shrink. */
    arrayFields?: ReadonlyArray<keyof TPayload>;
    /** Per-string-element budget when trimming array fields. */
    arrayElementCharLimit?: number;
  } = {},
): { payload: TPayload; trimmed: boolean; estimatedInputTokens: number } {
  const maxInputTokens = options.maxInputTokens ?? SAFE_INPUT_TOKEN_BUDGET;
  const textFields = (options.textFields ?? []) as ReadonlyArray<keyof TPayload>;
  const arrayFields = (options.arrayFields ?? []) as ReadonlyArray<keyof TPayload>;
  const arrayElementCharLimit = options.arrayElementCharLimit ?? 400;

  const estimate = (p: TPayload): number => {
    return ENVELOPE_OVERHEAD_TOKENS + estimateTokensFromChars(JSON.stringify(p).length);
  };

  let working: TPayload = { ...payload };
  let estimated = estimate(working);
  let trimmed = false;

  if (estimated <= maxInputTokens) {
    return { payload: working, trimmed: false, estimatedInputTokens: estimated };
  }

  // Pass 1: compact array elements.
  if (arrayFields.length > 0) {
    for (const field of arrayFields) {
      const value = working[field];
      if (Array.isArray(value)) {
        working = {
          ...working,
          [field]: value.map((element) => {
            if (typeof element === "string") {
              return element.length > arrayElementCharLimit
                ? element.slice(0, arrayElementCharLimit) + "…"
                : element;
            }
            if (element && typeof element === "object") {
              const compacted: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(element as Record<string, unknown>)) {
                if (typeof v === "string" && v.length > arrayElementCharLimit) {
                  compacted[k] = v.slice(0, arrayElementCharLimit) + "…";
                } else {
                  compacted[k] = v;
                }
              }
              return compacted;
            }
            return element;
          }),
        } as TPayload;
      }
    }
    estimated = estimate(working);
    trimmed = true;
  }

  if (estimated <= maxInputTokens) {
    return { payload: working, trimmed, estimatedInputTokens: estimated };
  }

  // Pass 2: truncate each configured text field.
  if (textFields.length > 0) {
    const overshoot = estimated - maxInputTokens;
    const perFieldTokens = Math.max(
      200,
      Math.floor((maxInputTokens - ENVELOPE_OVERHEAD_TOKENS) / textFields.length),
    );

    for (const field of textFields) {
      const value = working[field];
      if (typeof value === "string") {
        working = {
          ...working,
          [field]: truncateToTokenBudget(value, perFieldTokens),
        } as TPayload;
      }
    }
    estimated = estimate(working);
    trimmed = true;

    // If still over, halve the text fields again until we fit.
    let safety = 3;
    while (estimated > maxInputTokens && safety > 0) {
      for (const field of textFields) {
        const value = working[field];
        if (typeof value === "string") {
          working = {
            ...working,
            [field]: truncateToTokenBudget(value, Math.max(150, perFieldTokens / 2)),
          } as TPayload;
        }
      }
      estimated = estimate(working);
      safety -= 1;
    }

    // Avoid unused warning — overshoot lets us log if we want later.
    void overshoot;
  }

  return { payload: working, trimmed, estimatedInputTokens: estimated };
}
