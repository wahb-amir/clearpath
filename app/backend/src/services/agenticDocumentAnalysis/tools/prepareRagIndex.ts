import { z } from "zod";
import { withTransaction, pgPool } from "../../../db/pool";
import { buildChunks } from "../../ingestion/buildChunks";
import { buildDocumentStructure } from "../../ingestion/buildStructure";
import { embedBatch } from "../../ingestion/embeddingProvider";
import { persistChunks, persistSections } from "../../ingestion/persistence";
import type { AgentTool, AgentToolContext } from "../types";

export const PrepareRagIndexParamsSchema = z.object({}).optional();

export interface PrepareRagIndexResult {
  prepared: boolean;
  reason?: string;
  chunk_count: number;
}

type PrepareRagIndexParams = z.infer<typeof PrepareRagIndexParamsSchema>;

const CHUNK_CAP = 256;

/**
 * Defensive no-op tool. The orchestrator runs RAG indexing eagerly
 * before the agent loop starts. This tool exists so the agent has a
 * recovery path if a concurrent re-index slipped (e.g. document was
 * just re-uploaded) or if it wants to force a refresh.
 */
export const prepareRagIndexTool: AgentTool<
  "prepare_rag_index",
  PrepareRagIndexParams,
  PrepareRagIndexResult
> = {
  name: "prepare_rag_index",
  description:
    "Re-build (or build) the document's pgvector RAG index. Usually NOT needed — the orchestrator indexes automatically. Use only if you suspect the index is stale.",
  parameters: { type: "object", properties: {} },
  paramsSchema: PrepareRagIndexParamsSchema,
  sseEvent: {
    start: "ai_understanding_started",
    complete: "ai_understanding_completed",
  },
  handler: async (_args: PrepareRagIndexParams | undefined, ctx) => {
    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_understanding_started",
      stage: "AI_PROCESSING",
      message: "Preparing RAG index for long-document retrieval",
      progress: 12,
      payload: { stage: 1, total: 5, sub_step: "rag_index" },
    });

    // Quick check: is there already a meaningful chunk set?
    const existing = await pgPool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM document_chunks WHERE document_id = $1`,
      [ctx.document.document_id],
    );
    if ((existing.rows[0]?.c ?? 0) >= 16) {
      await ctx.emit({
        documentId: ctx.document.document_id,
        userId: ctx.document.user_id,
        eventType: "ai_understanding_completed",
        stage: "AI_PROCESSING",
        message: "RAG index already present",
        progress: 18,
        payload: { stage: 1, total: 5, sub_step: "rag_index", skipped: true },
      });
      return {
        prepared: false,
        reason: "index_already_present",
        chunk_count: existing.rows[0]!.c,
      };
    }

    const sections = buildDocumentStructure(ctx.document.source_text ?? "");
    const summary = ctx.document.source_text.slice(0, 500);
    const chunks = buildChunks({ documentSummary: summary, sections }).slice(0, CHUNK_CAP);
    const texts = chunks.map((c) => c.content);
    const embeddings = await embedBatch(texts);

    await withTransaction(async (client) => {
      const sectionIdMap = await persistSections(
        client,
        ctx.document.document_id,
        sections,
      );
      await persistChunks(
        client,
        ctx.document.document_id,
        chunks,
        sectionIdMap,
        embeddings,
      );
    });

    await ctx.emit({
      documentId: ctx.document.document_id,
      userId: ctx.document.user_id,
      eventType: "ai_understanding_completed",
      stage: "AI_PROCESSING",
      message: `RAG index ready — ${chunks.length} chunks`,
      progress: 18,
      payload: {
        stage: 1,
        total: 5,
        sub_step: "rag_index",
        chunk_count: chunks.length,
      },
    });

    return { prepared: true, chunk_count: chunks.length };
  },
};
