import type { Request, Response, NextFunction } from "express";
import {
  documentIdParamSchema,
  analyzeRequestBodySchema,
} from "../validators/documentAnalysis";
import { triggerAnalysis } from "../services/analysisRequestService";
import { pgPool } from "../db/pool";

interface AuthenticatedRequest extends Request {
  user?: {
    userId?: string;
    [key: string]: unknown;
  };
}

const IN_FLIGHT_ANALYSIS_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "EXTRACTING",
  "OCRING",
  "CLEANING",
  "STRUCTURING",
  "CHUNKING",
  "EMBEDDING",
  "SUMMARIZING",
  "PREPROCESSING_COMPLETED",
  "AI_QUEUED",
  "AI_PROCESSING",
  "AI_COMPLETED",
];

/**
 * POST /documents/:id/analyze
 *
 * Auth middleware (existing src/middlewares/auth.ts) must populate
 * req.user.userId before this handler runs.
 *
 * Enforces: A single user cannot have more than one in-flight analysis at a time.
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
      throw new Error("Missing authenticated userId");
    }

    // Check if the user already has another document in-flight (excluding this one)
    const inFlightCheck = await pgPool.query(
      `SELECT id, original_file_name, analysis_status
       FROM documents
       WHERE user_id = $1
         AND id != $2
         AND analysis_status IN (${IN_FLIGHT_ANALYSIS_STATUSES.map((s) => `'${s}'`).join(", ")})
       LIMIT 1`,
      [userId, documentId],
    );

    if (inFlightCheck.rowCount && inFlightCheck.rowCount > 0) {
      const runningDoc = inFlightCheck.rows[0];
      res.status(409).json({
        error: "concurrent_analysis_not_allowed",
        message: `You already have an analysis in progress for "${runningDoc.original_file_name}". Please wait for it to complete before starting a new one.`,
        runningDocumentId: runningDoc.id,
        runningStatus: runningDoc.analysis_status,
      });
      return;
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
