import type { PoolClient } from "pg";
import type { DocumentSectionDraft } from "./buildStructure";
import type { ChunkDraft } from "./buildChunks";
import type { ExtractedFact } from "./extractFacts";
import { embedBatch, toPgVectorLiteral } from "./embeddingProvider";

/**
 * Persists the section tree. Idempotent via cleanup-then-insert within
 * the caller's transaction: callers should DELETE existing sections for
 * this document_id before calling this (see workers stages), which is
 * safe because this entire step runs inside a single DB transaction
 * alongside the status update - if the job is retried after a crash
 * mid-stage, the delete+reinsert simply redoes the same deterministic
 * work.
 *
 * Returns a map from the in-memory DocumentSectionDraft object identity
 * to its persisted UUID, used by persistChunks to wire section_id.
 */
export async function persistSections(
  client: PoolClient,
  documentId: string,
  sections: DocumentSectionDraft[],
): Promise<Map<DocumentSectionDraft, string>> {
  const idMap = new Map<DocumentSectionDraft, string>();

  async function insert(
    node: DocumentSectionDraft,
    parentId: string | null,
  ): Promise<void> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO document_sections
         (document_id, parent_section_id, order_index, level, title, section_type, text_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        documentId,
        parentId,
        node.orderIndex,
        node.level,
        node.title,
        node.sectionType,
        node.textContent,
      ],
    );
    const id = result.rows[0].id;
    idMap.set(node, id);

    for (const child of node.children) {
      await insert(child, id);
    }
  }

  for (const top of sections) {
    await insert(top, null);
  }

  return idMap;
}

/**
 * Persists chunks with embeddings. Idempotent via
 * `ON CONFLICT (document_id, chunk_level, order_index, content_hash) DO NOTHING`
 * (see uq_chunks_dedupe) - if a previous attempt already inserted
 * identical chunks, re-running this is a no-op for those rows.
 *
 * Embeddings are generated in batch via @xenova/transformers
 * (bge-small-en-v1.5, 384-dim) before insertion.
 */
export async function persistChunks(
  client: PoolClient,
  documentId: string,
  chunks: ChunkDraft[],
  sectionIdMap: Map<DocumentSectionDraft, string>,
): Promise<void> {
  const embeddings = await embedBatch(chunks.map((c) => c.content));

  // Insert in order so parent rows exist before children reference them.
  // We rely on chunks[] being topologically ordered (document -> section
  // -> paragraph -> sentence), which buildChunks guarantees.
  const insertedIds: (string | null)[] = new Array(chunks.length).fill(null);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const sectionId = chunk.sectionDraftRef
      ? (sectionIdMap.get(chunk.sectionDraftRef) ?? null)
      : null;
    const parentChunkId =
      chunk.parentChunkIndex !== null
        ? insertedIds[chunk.parentChunkIndex]
        : null;

    const result = await client.query<{ id: string }>(
      `INSERT INTO document_chunks
         (document_id, section_id, chunk_level, parent_chunk_id, order_index, content, token_count, embedding, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (document_id, chunk_level, order_index, content_hash) DO UPDATE
         SET content = EXCLUDED.content
       RETURNING id`,
      [
        documentId,
        sectionId,
        chunk.chunkLevel,
        parentChunkId,
        chunk.orderIndex,
        chunk.content,
        chunk.tokenCount,
        toPgVectorLiteral(embeddings[i]),
        chunk.contentHash,
      ],
    );

    insertedIds[i] = result.rows[0]?.id ?? null;
  }
}

/**
 * Persists extracted facts. Idempotent via
 * `ON CONFLICT (document_id, fact_type, value) DO NOTHING` (uq_facts_dedupe).
 */
export async function persistFacts(
  client: PoolClient,
  documentId: string,
  facts: ExtractedFact[],
): Promise<void> {
  for (const fact of facts) {
    await client.query(
      `INSERT INTO document_facts
         (document_id, fact_type, value, normalized_value, confidence, context)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (document_id, fact_type, value) DO NOTHING`,
      [
        documentId,
        fact.factType,
        fact.value,
        fact.normalizedValue,
        fact.confidence,
        fact.context,
      ],
    );
  }
}

/**
 * Clears previously-persisted sections/chunks/facts for this document.
 * Called at the start of STRUCTURING (for sections/chunks) when
 * re-running a job (e.g. after FAILED -> retry) to avoid stale partial
 * trees from a crashed prior attempt. Safe because everything here is
 * deterministically regenerated from clean_text within the same job run.
 *
 * NOTE: this is only invoked when the worker determines the stage has
 * NOT already completed for this run (see workers/analysisWorker.ts
 * stage-guard logic) - on a clean resume where STRUCTURING already
 * finished, this is skipped entirely.
 */
export async function clearDerivedRecords(
  client: PoolClient,
  documentId: string,
): Promise<void> {
  // chunks reference sections via FK ON DELETE CASCADE, and reference
  // each other via parent_chunk_id ON DELETE CASCADE, so deleting
  // sections cascades chunks too. Facts are independent.
  await client.query(`DELETE FROM document_sections WHERE document_id = $1`, [
    documentId,
  ]);
  await client.query(
    `DELETE FROM document_chunks WHERE document_id = $1 AND section_id IS NULL`,
    [documentId],
  ); // document-level chunk has no section_id
  await client.query(`DELETE FROM document_facts WHERE document_id = $1`, [
    documentId,
  ]);
}
