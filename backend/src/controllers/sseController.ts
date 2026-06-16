import type { Request, Response, NextFunction } from 'express';
import { documentIdParamSchema, sseQuerySchema } from '../validators/documentAnalysis';
import { streamDocumentEvents } from '../sse/sseService';

/**
 * GET /documents/:id/events
 *
 * Supports reconnection via the standard `Last-Event-ID` header (sent
 * automatically by EventSource on reconnect) or a `?lastEventId=`
 * query param fallback.
 */
export async function streamDocumentEventsController(
  req: Request & { user?: { id: string } },
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: documentId } = documentIdParamSchema.parse(req.params);
    const { lastEventId: queryLastEventId } = sseQuerySchema.parse(req.query);

    const headerLastEventId = req.header('Last-Event-ID');
    const lastEventId = headerLastEventId
      ? Number.parseInt(headerLastEventId, 10)
      : queryLastEventId ?? null;

    const userId = req.user!.userId;

    await streamDocumentEvents({
      res,
      documentId,
      userId,
      lastEventId: Number.isFinite(lastEventId as number) ? (lastEventId as number) : null,
    });
  } catch (err) {
    next(err);
  }
}
