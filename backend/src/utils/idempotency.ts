import { createHash } from 'crypto';

/**
 * Derives a deterministic idempotency key when the client doesn't
 * supply one. Same (userId, documentId, purpose, analysisVersion)
 * always produces the same key, which is enforced UNIQUE at the DB
 * level (document_analysis_requests.idempotency_key).
 *
 * This is what guarantees: repeated analyze clicks for the same file
 * + same analysis version -> same request row, no duplicate jobs.
 */
export function deriveIdempotencyKey(params: {
  userId: string;
  documentId: string;
  purpose: string;
  analysisVersion: string;
}): string {
  const { userId, documentId, purpose, analysisVersion } = params;
  const raw = `${userId}:${documentId}:${purpose}:${analysisVersion}`;
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Derives the BullMQ jobId from the analysis request id. Using the
 * request id (which is unique per idempotency key) as the BullMQ
 * jobId means BullMQ itself rejects duplicate enqueues for the same
 * request — a second layer of dedup beyond the DB unique constraint.
 */
export function jobIdForAnalysisRequest(analysisRequestId: string): string {
  return `analysis:${analysisRequestId}`;
}
