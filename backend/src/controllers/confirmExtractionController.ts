import type { Request, Response, NextFunction } from "express";
import { pgPool, withTransaction } from "../db/pool";
import { insertPipelineEvent } from "../services/analysisRequestService";
import {
  createPublisherConnection,
  channelForDocument,
} from "../redis/connection";
import { env } from "../config/env";

interface AuthenticatedRequest extends Request {
  user?: { userId?: string; [key: string]: unknown };
}

/**
 * POST /analysis/documents/:id/confirm-extraction
 *
 * Body (optional — the user's edited version of extracted content):
 *   { extractedContent?: object }
 *
 * Flow:
 *  1. Verify the document belongs to this user and is in AWAITING_VERIFICATION
 *  2. Persist the (possibly edited) extractedContent back to documents
 *  3. Transition document status → PREPROCESSING_COMPLETED
 *  4. Insert outbox event document.extraction.verified → dispatcher picks it
 *     up and enqueues the AI analysis BullMQ job
 *  5. Emit SSE pipeline event so the frontend resumes the progress view
 *  6. Return 200 immediately
 */
export async function confirmExtractionController(
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

    const publisher = createPublisherConnection();

    await withTransaction(async (client) => {
      // 1. Lock and verify
      const docResult = await client.query(
        `SELECT id, user_id, analysis_status, extracted_content, storage_path, mime_type
           FROM documents
          WHERE id = $1
          FOR UPDATE`,
        [documentId],
      );

      if (docResult.rowCount === 0) {
        throw Object.assign(new Error("Document not found"), {
          statusCode: 404,
        });
      }

      const doc = docResult.rows[0];

      if (doc.user_id !== userId) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }

      if (doc.analysis_status !== "AWAITING_VERIFICATION") {
        throw Object.assign(
          new Error(
            `Document is not awaiting verification (current: ${doc.analysis_status})`,
          ),
          { statusCode: 409 },
        );
      }

      // 2. Persist (possibly edited) extracted content
      const contentToSave =
        extractedContent !== undefined
          ? extractedContent
          : doc.extracted_content;

      await client.query(
        `UPDATE documents
            SET analysis_status   = 'VERIFIED',
                current_stage     = 'VERIFIED',
                extracted_content = $1::jsonb
          WHERE id = $2`,
        [JSON.stringify(contentToSave), documentId],
      );

      // 3. Fetch the active analysis request so we know the IDs needed to
      //    resume. Status stays PROCESSING (worker will pick it up again).
      const reqResult = await client.query(
        `SELECT id
           FROM document_analysis_requests
          WHERE document_id = $1
            AND status IN ('PENDING','QUEUED','PROCESSING')
          ORDER BY created_at DESC
          LIMIT 1`,
        [documentId],
      );

      if (reqResult.rowCount === 0) {
        throw Object.assign(
          new Error("No active analysis request found for this document"),
          { statusCode: 409 },
        );
      }

      const analysisRequestId = reqResult.rows[0].id;
      const analysisVersion = env.ANALYSIS_VERSION;

      // 4. Insert SSE pipeline event for extraction_verified
      const eventRow = await insertPipelineEvent(client, {
        documentId,
        userId,
        eventType: "extraction_verified" as any,
        stage: "VERIFIED",
        message: "Extraction verified — continuing analysis",
        progress: 42,
        payload: { analysisRequestId, verifiedBy: userId },
      });

      // 5. Insert outbox row to trigger AI queue job
      await client.query(
        `INSERT INTO document_pipeline_outbox
           (event_type, aggregate_type, aggregate_id, payload, status)
         VALUES ('document.extraction.verified', 'document_analysis_request', $1, $2::jsonb, 'pending')`,
        [
          analysisRequestId,
          JSON.stringify({
            documentId,
            userId,
            analysisRequestId,
            analysisVersion,
            storagePath: doc.storage_path,
            mimeType: doc.mime_type,
          }),
        ],
      );

      // 6. Notify Redis so SSE clients pick up the new event immediately
      setImmediate(async () => {
        try {
          await publisher.publish(
            channelForDocument(documentId),
            JSON.stringify({ documentId, eventId: eventRow.id }),
          );
          publisher.disconnect();
        } catch {
          // non-fatal
        }
      });
    });

    res.status(200).json({
      success: true,
      message: "Extraction confirmed. AI analysis queued.",
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
