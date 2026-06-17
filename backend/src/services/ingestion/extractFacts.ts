/**
 * Extracts structured facts/entities via regex-based detectors.
 * Each fact includes a short context snippet for downstream display
 * and a normalized value where applicable (e.g. ISO date).
 *
 * Kept dependency-free and fast; can be swapped/augmented later with
 * an NER model without changing the document_facts schema.
 */

export interface ExtractedFact {
  factType:
    | 'date'
    | 'email'
    | 'phone'
    | 'url'
    | 'address'
    | 'name'
    | 'amount'
    | 'deadline'
    | 'reference_id';
  value: string;
  normalizedValue: string | null;
  confidence: number;
  context: string;
}

const CONTEXT_RADIUS = 40;

function context(text: string, index: number, length: number): string {
  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = Math.min(text.length, index + length + CONTEXT_RADIUS);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

const PATTERNS: Array<{
  type: ExtractedFact['factType'];
  regex: RegExp;
  normalize?: (match: string) => string | null;
  confidence: number;
}> = [
  {
    type: 'email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    confidence: 0.98,
  },
  {
    type: 'url',
    regex: /\bhttps?:\/\/[^\s)>\]]+/g,
    confidence: 0.98,
  },
  {
    type: 'phone',
    // Requires a `+` country code OR a parenthesized area code to qualify
    // as a phone match on its own — this avoids false positives on roll
    // numbers, reference codes, and other hyphenated digit groups (e.g.
    // "CS-2021-045") that happen to fall in a similar digit-length range.
    regex: /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{2,4}|\(\d{2,4}\)[\s-]?\d{3,4}[\s-]?\d{2,4}/g,
    confidence: 0.85,
  },
  {
    type: 'phone',
    // Lower-confidence fallback: bare digit-group phone numbers, but
    // ONLY when immediately preceded by a phone-indicating label
    // (Phone/Tel/Mobile/Cell/Contact) within the same line, so we don't
    // match arbitrary hyphenated numeric codes elsewhere in the text.
    regex: /\b(?:Phone|Tel|Mobile|Cell|Contact)\s*:?\s*(\d{3,4}[\s-]?\d{3,4}(?:[\s-]?\d{2,4})?)/gi,
    confidence: 0.75,
  },
  {
    type: 'date',
    // Matches "12 June 2026", "June 12, 2026", "2026-06-15", "12/06/2026"
    regex:
      /\b(\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/gi,
    normalize: (match) => normalizeDate(match),
    confidence: 0.85,
  },
  {
    type: 'amount',
    // Currency amounts: $1,000.00, PKR 50,000, Rs. 1500, USD 99.99
    regex: /\b(?:(?:USD|PKR|Rs\.?|\$|€|£)\s?[\d,]+(?:\.\d{1,2})?)\b/g,
    confidence: 0.75,
  },
  {
    type: 'reference_id',
    // Alphanumeric codes with mix of letters+digits, length 6-20, with at least one digit
    regex: /\b(?=[A-Z0-9-]{6,20}\b)(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,20}\b/g,
    confidence: 0.4,
  },
];

const DEADLINE_KEYWORDS = /\b(deadline|due date|due by|must be submitted by|expires? on)\b/i;

function normalizeDate(raw: string): string | null {
  const parsed = new Date(raw.replace(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, '$3-$2-$1'));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function extractFacts(cleanText: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    for (const match of cleanText.matchAll(pattern.regex)) {
      const value = match[0].trim();
      if (!value) continue;

      const dedupeKey = `${pattern.type}:${value}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const idx = match.index ?? 0;
      const ctx = context(cleanText, idx, value.length);

      let factType = pattern.type;
      // Promote 'date' to 'deadline' if nearby context mentions deadline language
      if (factType === 'date' && DEADLINE_KEYWORDS.test(ctx)) {
        factType = 'deadline';
      }

      facts.push({
        factType,
        value,
        normalizedValue: pattern.normalize ? pattern.normalize(value) : null,
        confidence: pattern.confidence,
        context: ctx,
      });
    }
  }

  return facts;
}
