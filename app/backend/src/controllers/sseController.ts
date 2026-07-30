import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middlewares/auth";
import {
  documentIdParamSchema,
  sseQuerySchema,
} from "../validators/documentAnalysis";
import { streamDocumentEvents } from "../sse/sseService";

export async function streamDocumentEventsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: documentId } = documentIdParamSchema.parse(req.params);
    const { lastEventId: queryLastEventId } = sseQuerySchema.parse(req.query);

    const headerLastEventId = req.header("Last-Event-ID");
    const lastEventId = headerLastEventId
      ? Number.parseInt(headerLastEventId, 10)
      : (queryLastEventId ?? null);

    // Now TypeScript knows userId exists on req.user
    const userId = req.user!.userId;

    await streamDocumentEvents({
      res,
      documentId,
      userId,
      lastEventId: Number.isFinite(lastEventId as number)
        ? (lastEventId as number)
        : null,
    });
  } catch (err) {
    next(err);
  }
}
