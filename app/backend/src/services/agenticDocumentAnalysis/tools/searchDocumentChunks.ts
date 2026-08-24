import { z } from "zod";
import { retrieveForQuery } from "../../retrieval/router";
import type { AgentTool } from "../types";

export const SearchDocumentChunksParamsSchema = z.object({
  query: z.string().min(1).max(500),
  top_k: z.number().int().min(1).max(16).default(8),
});

export interface SearchDocumentChunksHit {
  intent: string;
  chunks: Array<{
    id: string;
    chunk_level: string;
    section_id: string | null;
    content: string;
    similarity: number;
  }>;
  facts: Array<{
    fact_type: string;
    value: string;
    normalized_value: string | null;
    context: string;
  }>;
}

export const searchDocumentChunksTool: AgentTool<
  "search_document_chunks",
  z.infer<typeof SearchDocumentChunksParamsSchema>,
  SearchDocumentChunksHit
> = {
  name: "search_document_chunks",
  description:
    "Vector + keyword retrieval over the document's chunks (bge-small-en-v1.5 embeddings, pgvector HNSW index). Returns up to top_k chunks plus any matching document_facts rows for exact-fact queries. Use this whenever you need to recall a specific fact, find evidence for a claim, or re-check a section you haven't read yet.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Natural-language search query (1-500 chars).",
      },
      top_k: {
        type: "integer",
        minimum: 1,
        maximum: 16,
        default: 8,
      },
    },
    required: ["query", "top_k"],
  },
  paramsSchema: SearchDocumentChunksParamsSchema,
  sseEvent: {
    start: "ai_extraction_started",
    complete: "ai_extraction_completed",
  },
  handler: async (args, ctx) => {
    const result = await retrieveForQuery({
      documentId: ctx.document.document_id,
      query: args.query,
      topK: args.top_k,
    });

    return {
      intent: result.intent,
      chunks: result.chunks.map((c) => ({
        id: c.id,
        chunk_level: c.chunkLevel,
        section_id: c.sectionId,
        content: c.content,
        similarity: c.similarity,
      })),
      facts: result.facts.map((f) => ({
        fact_type: f.factType,
        value: f.value,
        normalized_value: f.normalizedValue,
        context: f.context,
      })),
    };
  },
};
