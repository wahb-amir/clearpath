import type { Request, Response, NextFunction } from "express";
import { pgPool } from "../db/pool";
import {
  createPublisherConnection,
  channelForDocument,
} from "../redis/connection";

interface AuthenticatedRequest extends Request {
  user?: { userId?: string; [key: string]: unknown };
}

/**
 * PATCH /analysis/documents/:id/extracted-content
 *
 * Body:
 *   { extractedContent: object }
 *
 * Flow:
 *  1. Verify the document belongs to this user and is AWAITING_VERIFICATION
 *  2. Update the document's extracted_content in DB (for persistence across refresh)
 *  3. Publish an ephemeral Redis notification to instantly push the draft state
 *     to all connected clients via SSE without flooding the Postgres event log
 */
export async function saveExtractionDraftController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const documentId = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { extractedContent } = (req.body ?? {}) as {
      extractedContent?: Record<string, unknown>;
    };

    if (extractedContent === undefined) {
      res.status(400).json({ error: "Missing extractedContent payload" });
      return;
    }

    // 1 & 2. Update the DB only if in correct state
    // We do not need a transaction lock just to save draft if we rely on last-write-wins
    const updateResult = await pgPool.query(
      `UPDATE documents
          SET extracted_content = $1::jsonb
        WHERE id = $2
          AND user_id = $3
          AND analysis_status = 'AWAITING_VERIFICATION'
        RETURNING id`,
      [JSON.stringify(extractedContent), documentId, userId]
    );

    if (updateResult.rowCount === 0) {
      // Document not found, unauthorized, or not awaiting verification
      throw Object.assign(
        new Error("Document not found or not currently awaiting verification"),
        { statusCode: 404 }
      );
    }

    // 3. Publish ephemeral event via Redis to wake up SSE subscribers
    const publisher = createPublisherConnection();
    try {
      await publisher.publish(
        channelForDocument(documentId),
        JSON.stringify({
          documentId,
          ephemeral: true,
          eventRecord: {
            id: Date.now(), // ephemeral ID
            documentId,
            userId,
            eventType: "extraction_draft_updated",
            stage: "AWAITING_VERIFICATION",
            message: "Draft saved by user",
            progress: null,
            payload: { extractedContent, updatedBy: userId },
            createdAt: new Date().toISOString(),
          },
        })
      );
    } finally {
      publisher.disconnect();
    }

    res.status(200).json({
      success: true,
      message: "Draft saved successfully",
    });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? undefined;
    if (statusCode) {
      res.status(statusCode).json({ error: (err as Error).message });
      return;
    }
    next(err);
  }
}
