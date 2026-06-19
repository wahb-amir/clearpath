import { createHash } from "crypto";

// Lazy-loaded singleton pipeline - @xenova/transformers downloads/caches
// the ONNX model on first use (set TRANSFORMERS_CACHE env var to control
// the cache directory in production).
type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: Float32Array }>;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      const extractor = await pipeline(
        "feature-extraction",
        "Xenova/bge-small-en-v1.5",
      );
      return extractor as unknown as FeatureExtractionPipeline;
    })();
  }
  return extractorPromise;
}

export const EMBEDDING_DIMENSIONS = 384;

/**
 * Generates a normalized 384-dim embedding for the given text using
 * BAAI/bge-small-en-v1.5 via @xenova/transformers (in-process ONNX
 * inference - no external API calls, no per-call cost).
 *
 * bge models recommend prefixing queries (not passages) with
 * "Represent this sentence for searching relevant passages: " - we
 * only embed passages/chunks here, so no prefix is applied. If you
 * later add query-time embedding for retrieval, apply that prefix
 * to the QUERY text only.
 */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Batches embedding calls sequentially (the ONNX runtime here is
 * single-threaded per call; sequential keeps memory bounded for large
 * documents). For higher throughput, consider running multiple worker
 * processes rather than parallelizing within one.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedText(text));
  }
  return results;
}

/** Stable content hash used for chunk de-duplication on retry. */
export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Formats a JS number array as a pgvector literal, e.g. '[0.1,0.2,...]' */
export function toPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
