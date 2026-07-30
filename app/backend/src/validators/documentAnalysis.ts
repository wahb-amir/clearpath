import { z } from "zod";

export const documentIdParamSchema = z.object({
  id: z.string().uuid("Invalid document id"),
});

export type DocumentIdParam = z.infer<typeof documentIdParamSchema>;

/**
 * Body for POST /documents/:id/analyze.
 * `idempotencyKey` is optional - if the client doesn't provide one, the
 * server derives a deterministic key from (userId, documentId, purpose,
 * analysisVersion).
 */
export const analyzeRequestBodySchema = z.object({
  idempotencyKey: z.string().min(8).max(255).optional(),
  purpose: z.string().min(1).max(64).default("full_analysis"),
  analysisVersion: z.string().min(1).max(32).optional(), // defaults to env.ANALYSIS_VERSION
});

export type AnalyzeRequestBody = z.infer<typeof analyzeRequestBodySchema>;

/**
 * Query params for GET /documents/:id/events (SSE).
 * Last-Event-ID is normally sent as a header by EventSource on
 * reconnect, but we also accept it as a query param for the initial
 * connection / non-browser clients.
 */
export const sseQuerySchema = z.object({
  lastEventId: z.coerce.number().int().nonnegative().optional(),
});

export type SseQuery = z.infer<typeof sseQuerySchema>;
