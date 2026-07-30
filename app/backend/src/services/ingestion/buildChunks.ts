import type { DocumentSectionDraft } from "./buildStructure";
import { contentHash } from "./embeddingProvider";

/**
 * Hierarchical chunk representation, written to document_chunks with
 * parent_chunk_id relationships:
 *
 *   document  (chunk_level='document')   <- whole-doc summary embedding
 *     └─ section  (chunk_level='section') <- one per top-level/major section
 *          └─ paragraph (chunk_level='paragraph')
 *               └─ sentence (chunk_level='sentence', OPTIONAL fallback,
 *                            only generated for long/dense paragraphs)
 *
 * This is the "smarter than basic RAG" design: instead of flat
 * fixed-size chunks, retrieval can route by query type (see
 * services/retrieval/router.ts):
 *   - broad questions      -> document + section chunks
 *   - detailed questions   -> section + paragraph chunks
 *   - exact fact lookups    -> document_facts (structured) + keyword search
 *   - fallback              -> sentence-level vector search
 */

export interface ChunkDraft {
  chunkLevel: "document" | "section" | "paragraph" | "sentence";
  sectionId: string | null; // assigned by caller after section insertion
  sectionDraftRef?: DocumentSectionDraft; // internal linkage before DB insert
  parentChunkIndex: number | null; // index into the flat chunks array, resolved to parent_chunk_id after insert
  orderIndex: number;
  content: string;
  tokenCount: number;
  contentHash: string;
}

const PARAGRAPH_SPLIT = /\n\s*\n/;
const SENTENCE_SPLIT = /(?<=[.!?\u06D4])\s+(?=[A-Z\u0600-\u06FF])/; // \u06D4 = Urdu full stop

// Paragraphs longer than this many tokens get sentence-level fallback chunks
const SENTENCE_FALLBACK_TOKEN_THRESHOLD = 220;

/** Rough token estimate: ~4 chars per token for English, ~2-3 for Urdu script. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Flattens the section tree (from buildStructure) into chunk drafts at
 * section, paragraph, and (where needed) sentence levels, plus one
 * document-level chunk for the whole-document summary (content filled
 * in by the caller after summary generation - see buildChunks below).
 */
export function buildChunks(params: {
  documentSummary: string;
  sections: DocumentSectionDraft[];
}): ChunkDraft[] {
  const { documentSummary, sections } = params;
  const chunks: ChunkDraft[] = [];

  // 1. Document-level chunk (whole-document summary)
  chunks.push({
    chunkLevel: "document",
    sectionId: null,
    parentChunkIndex: null,
    orderIndex: 0,
    content: documentSummary,
    tokenCount: estimateTokens(documentSummary),
    contentHash: contentHash(`document:${documentSummary}`),
  });

  const documentChunkIndex = 0;
  let sectionOrderCounter = 0;

  const visit = (node: DocumentSectionDraft, parentChunkIndex: number) => {
    const sectionText =
      (node.title ? `${node.title}\n` : "") +
      node.textContent +
      (node.children.length === 0
        ? ""
        : "\n" +
          node.children
            .map((c) => c.title ?? c.textContent.slice(0, 80))
            .join("\n"));

    // 2. Section-level chunk (title + own text, used for routing/summary search)
    const sectionChunkIndex = chunks.length;
    chunks.push({
      chunkLevel: "section",
      sectionId: null,
      sectionDraftRef: node,
      parentChunkIndex,
      orderIndex: sectionOrderCounter++,
      content: sectionText.trim() || node.title || "(untitled section)",
      tokenCount: estimateTokens(sectionText),
      contentHash: contentHash(
        `section:${node.title ?? ""}:${node.textContent}`,
      ),
    });

    // 3. Paragraph-level chunks from this section's own text
    if (node.textContent.trim().length > 0) {
      const paragraphs = node.textContent
        .split(PARAGRAPH_SPLIT)
        .filter((p) => p.trim());
      paragraphs.forEach((paragraph, pIdx) => {
        const tokenCount = estimateTokens(paragraph);
        const paragraphChunkIndex = chunks.length;

        chunks.push({
          chunkLevel: "paragraph",
          sectionId: null,
          sectionDraftRef: node,
          parentChunkIndex: sectionChunkIndex,
          orderIndex: pIdx,
          content: paragraph.trim(),
          tokenCount,
          contentHash: contentHash(
            `paragraph:${node.title ?? ""}:${pIdx}:${paragraph}`,
          ),
        });

        // 4. Sentence-level fallback chunks for long/dense paragraphs
        if (tokenCount > SENTENCE_FALLBACK_TOKEN_THRESHOLD) {
          const sentences = paragraph
            .split(SENTENCE_SPLIT)
            .filter((s) => s.trim());
          sentences.forEach((sentence, sIdx) => {
            chunks.push({
              chunkLevel: "sentence",
              sectionId: null,
              sectionDraftRef: node,
              parentChunkIndex: paragraphChunkIndex,
              orderIndex: sIdx,
              content: sentence.trim(),
              tokenCount: estimateTokens(sentence),
              contentHash: contentHash(
                `sentence:${node.title ?? ""}:${pIdx}:${sIdx}:${sentence}`,
              ),
            });
          });
        }
      });
    }

    for (const child of node.children) {
      visit(child, sectionChunkIndex);
    }
  };

  for (const top of sections) {
    visit(top, documentChunkIndex);
  }

  return chunks;
}
