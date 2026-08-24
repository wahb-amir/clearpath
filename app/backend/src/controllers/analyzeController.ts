import type { Request, Response, NextFunction } from "express";
import {
  documentIdParamSchema,
  analyzeRequestBodySchema,
  analyzeQuerySchema,
} from "../validators/documentAnalysis";
import { triggerAnalysis } from "../services/analysisRequestService";
import { pgPool } from "../db/pool";
import { env } from "../config/env";

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
    const query = analyzeQuerySchema.parse(req.query ?? {});

    const userId = req.user?.userId;
    if (!userId) {
      throw new Error("Missing authenticated userId");
    }

    // Resolve pipeline: per-request query param takes precedence when
    // present, otherwise fall back to env.AGENTIC_PIPELINE_DEFAULT.
    // AGENTIC_PIPELINE_ENABLED is a hard kill-switch — if disabled in
    // env, every request is forced to classic regardless of the query
    // param.
    const requestedPipeline = query.pipeline ?? env.AGENTIC_PIPELINE_DEFAULT;
    const pipeline =
      requestedPipeline === "agentic" && !env.AGENTIC_PIPELINE_ENABLED
        ? "classic"
        : requestedPipeline;

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
      pipeline,
    });

    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
}
