import type { Request, Response, NextFunction } from 'express';
import { documentIdParamSchema, analyzeRequestBodySchema } from '../validators/documentAnalysis';
import { triggerAnalysis } from '../services/analysisRequestService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId?: string;
    [key: string]: unknown;
  };
}

/**
 * POST /documents/:id/analyze
 *
 * Auth middleware (existing src/middlewares/auth.ts) must populate
 * req.user.userId before this handler runs.
 */
export async function analyzeDocumentController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: documentId } = documentIdParamSchema.parse(req.params);
    const body = analyzeRequestBodySchema.parse(req.body ?? {});

    const userId = req.user?.userId;
    if (!userId) {
      throw new Error('Missing authenticated userId');
    }

    const result = await triggerAnalysis({
      documentId,
      userId,
      purpose: body.purpose,
      analysisVersion: body.analysisVersion,
      clientIdempotencyKey: body.idempotencyKey,
    });

    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
}
