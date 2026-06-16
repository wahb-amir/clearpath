import { pgPool } from '../../db/pool';
import { embedText, toPgVectorLiteral } from '../ingestion/embeddingProvider';

/**
 * Hybrid retrieval router.
 *
 * Implements the strategy from the spec:
 *  - broad questions      -> document + section chunks (summary level)
 *  - detailed questions   -> section + paragraph chunks
 *  - exact fact lookups    -> document_facts (structured) + keyword search
 *  - fallback              -> sentence-level vector search
 *
 * Query classification is a lightweight heuristic (length + keyword
 * patterns); replace with an LLM-based classifier if needed without
 * changing the downstream retrieval calls.
 */

export type QueryIntent = 'broad' | 'detailed' | 'fact_lookup' | 'fallback';

const FACT_LOOKUP_PATTERNS = [
  /\bwhat is (the )?(date|deadline|email|phone|amount|reference|address)\b/i,
  /\bwhen is\b/i,
  /\bhow much\b/i,
  /\b(email|phone|amount|deadline|reference number|address) (of|for)\b/i,
];

const BROAD_QUESTION_PATTERNS = [
  /\b(summarize|overview|what is this document about|main points|key takeaways)\b/i,
];

export function classifyQueryIntent(query: string): QueryIntent {
  if (FACT_LOOKUP_PATTERNS.some((p) => p.test(query))) return 'fact_lookup';
  if (BROAD_QUESTION_PATTERNS.some((p) => p.test(query)) || query.split(/\s+/).length <= 6) {
    return 'broad';
  }
  if (query.split(/\s+/).length > 20) return 'fallback';
  return 'detailed';
}

export interface RetrievedChunk {
  id: string;
  chunkLevel: string;
  sectionId: string | null;
  content: string;
  similarity: number;
}

export interface RetrievedFact {
  factType: string;
  value: string;
  normalizedValue: string | null;
  context: string;
}

export interface RetrievalResult {
  intent: QueryIntent;
  chunks: RetrievedChunk[];
  facts: RetrievedFact[];
}

/**
 * Main retrieval entry point. Embeds the query (with the bge "query"
 * instruction prefix, per BAAI's recommendation for asymmetric search),
 * then retrieves from the appropriate chunk levels / facts table based
 * on classified intent.
 */
export async function retrieveForQuery(params: {
  documentId: string;
  query: string;
  topK?: number;
}): Promise<RetrievalResult> {
  const { documentId, query, topK = 8 } = params;
  const intent = classifyQueryIntent(query);

  if (intent === 'fact_lookup') {
    const facts = await keywordSearchFacts(documentId, query);
    if (facts.length > 0) {
      return { intent, chunks: [], facts };
    }
    // No structured facts matched - fall through to vector search
  }

  const queryEmbedding = await embedText(
    `Represent this sentence for searching relevant passages: ${query}`,
  );

  const levels = levelsForIntent(intent);
  const chunks = await vectorSearchChunks(documentId, queryEmbedding, levels, topK);

  return { intent, chunks, facts: [] };
}

function levelsForIntent(intent: QueryIntent): string[] {
  switch (intent) {
    case 'broad':
      return ['document', 'section'];
    case 'detailed':
      return ['section', 'paragraph'];
    case 'fallback':
    case 'fact_lookup': // fact_lookup fallback when no structured facts match
      return ['sentence', 'paragraph'];
    default:
      return ['paragraph'];
  }
}

async function vectorSearchChunks(
  documentId: string,
  queryEmbedding: number[],
  levels: string[],
  topK: number,
): Promise<RetrievedChunk[]> {
  const result = await pgPool.query<{
    id: string;
    chunk_level: string;
    section_id: string | null;
    content: string;
    similarity: number;
  }>(
    `SELECT id, chunk_level, section_id, content,
            1 - (embedding <=> $1::vector) AS similarity
       FROM document_chunks
      WHERE document_id = $2 AND chunk_level = ANY($3)
      ORDER BY embedding <=> $1::vector
      LIMIT $4`,
    [toPgVectorLiteral(queryEmbedding), documentId, levels, topK],
  );

  return result.rows.map((r) => ({
    id: r.id,
    chunkLevel: r.chunk_level,
    sectionId: r.section_id,
    content: r.content,
    similarity: r.similarity,
  }));
}

/**
 * Keyword search over document_facts for exact lookups (dates, emails,
 * phones, amounts, etc.) - uses simple ILIKE matching on fact_type
 * keywords found in the query plus a trigram/ILIKE scan over values.
 */
async function keywordSearchFacts(documentId: string, query: string): Promise<RetrievedFact[]> {
  const typeHints: Record<string, string> = {
    date: 'date',
    deadline: 'deadline',
    email: 'email',
    phone: 'phone',
    amount: 'amount',
    address: 'address',
    reference: 'reference_id',
  };

  const matchedTypes = Object.entries(typeHints)
    .filter(([keyword]) => query.toLowerCase().includes(keyword))
    .map(([, type]) => type);

  if (matchedTypes.length === 0) return [];

  const result = await pgPool.query<{
    fact_type: string;
    value: string;
    normalized_value: string | null;
    context: string;
  }>(
    `SELECT fact_type, value, normalized_value, context
       FROM document_facts
      WHERE document_id = $1 AND fact_type = ANY($2)
      ORDER BY created_at ASC
      LIMIT 20`,
    [documentId, matchedTypes],
  );

  return result.rows.map((r) => ({
    factType: r.fact_type,
    value: r.value,
    normalizedValue: r.normalized_value,
    context: r.context,
  }));
}
