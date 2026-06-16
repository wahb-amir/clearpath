import type { PoolClient } from 'pg';
import { withTransaction } from '../db/pool';
import { env } from '../config/env';
import {
  DocumentNotFoundError,
  ForbiddenDocumentAccessError,
  UploadNotCompleteError,
} from '../types/errors';
import type {
  AnalysisRequestRow,
  AnalysisRequestedOutboxPayload,
  AnalyzeResponseDto,
  DocumentRow,
} from '../types/dtos';
import { deriveIdempotencyKey } from '../utils/idempotency';
import { isInFlight, isTerminal } from '../types/pipelineStatus';

interface TriggerAnalysisParams {
  documentId: string;
  userId: string;
  purpose: string;
  analysisVersion?: string;
  clientIdempotencyKey?: string;
}

/**
 * Core atomic flow for POST /documents/:id/analyze.
 *
 * Steps (all within ONE transaction):
 *  1. Begin transaction
 *  2. SELECT ... FOR UPDATE on documents row (lock)
 *  3. Validate ownership + upload status
 *  4. Check for existing analysis request via idempotency key
 *     (or via an existing IN-FLIGHT request for this document)
 *  5. Insert or reuse document_analysis_requests row
 *  6. Update documents.analysis_status -> QUEUED (if appropriate)
 *  7. Insert document_pipeline_outbox row (event: analysis.requested)
 *  8. Commit
 *
 * A separate dispatcher (src/outbox/dispatcher.ts) reads the outbox
 * and enqueues the BullMQ job. If that enqueue fails, the outbox row
 * stays 'pending' and is retried — the DB state above is already
 * correct and consistent regardless of queue availability.
 */
export async function triggerAnalysis(
  params: TriggerAnalysisParams,
): Promise<AnalyzeResponseDto> {
  const analysisVersion = params.analysisVersion ?? env.ANALYSIS_VERSION;

  return withTransaction(async (client) => {
    // 2. Lock the document row
    const docResult = await client.query<DocumentRow>(
      `SELECT * FROM documents WHERE id = $1 FOR UPDATE`,
      [params.documentId],
    );

    if (docResult.rowCount === 0) {
      throw new DocumentNotFoundError(params.documentId);
    }

    const doc = docResult.rows[0];

    // 3. Validate ownership
    if (doc.user_id !== params.userId) {
      throw new ForbiddenDocumentAccessError(params.documentId);
    }

    // 3. Validate upload status
    if (doc.upload_status !== 'UPLOADED') {
      throw new UploadNotCompleteError(params.documentId, doc.upload_status);
    }

    // 4. Compute idempotency key
    const idempotencyKey =
      params.clientIdempotencyKey ??
      deriveIdempotencyKey({
        userId: params.userId,
        documentId: params.documentId,
        purpose: params.purpose,
        analysisVersion,
      });

    // 4. Check for an existing request with this idempotency key
    const existingByKey = await client.query<AnalysisRequestRow>(
      `SELECT * FROM document_analysis_requests WHERE idempotency_key = $1 FOR UPDATE`,
      [idempotencyKey],
    );

    if (existingByKey.rows.length > 0) {
      // Same (user, document, purpose, version) request already exists.
      // Do NOT create a new row or a new outbox event - return existing.
      const existing = existingByKey.rows[0];
      return buildResponse(doc, existing, {
        isNewRequest: false,
        reason: 'idempotency_key_match: returning existing analysis request',
      });
    }

    // Additional guard: if the document is currently in-flight under a
    // DIFFERENT idempotency key (e.g. client retried without sending
    // the same key, but analysisVersion bumped mid-flight is rare),
    // refuse to queue a second concurrent pipeline run for the same doc.
    if (isInFlight(doc.analysis_status)) {
      const inFlightRequest = await client.query<AnalysisRequestRow>(
        `SELECT * FROM document_analysis_requests
           WHERE document_id = $1 AND status IN ('PENDING','QUEUED','PROCESSING')
           ORDER BY created_at DESC LIMIT 1
           FOR UPDATE`,
        [params.documentId],
      );

      if (inFlightRequest.rows.length > 0) {
        return buildResponse(doc, inFlightRequest.rows[0], {
          isNewRequest: false,
          reason: 'document_already_in_flight: returning active analysis request',
        });
      }
    }

    // 5. Insert new analysis request (ON CONFLICT guards race conditions
    // where two requests with the same idempotency key are submitted
    // concurrently - the unique index wins, and we re-select).
    const insertResult = await client.query<AnalysisRequestRow>(
      `INSERT INTO document_analysis_requests
         (document_id, user_id, idempotency_key, status)
       VALUES ($1, $2, $3, 'PENDING')
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [params.documentId, params.userId, idempotencyKey],
    );

    let analysisRequest: AnalysisRequestRow;

    if (insertResult.rows.length > 0) {
      analysisRequest = insertResult.rows[0];
    } else {
      // Lost the race to a concurrent transaction - fetch the winner's row
      const fallback = await client.query<AnalysisRequestRow>(
        `SELECT * FROM document_analysis_requests WHERE idempotency_key = $1`,
        [idempotencyKey],
      );
      return buildResponse(doc, fallback.rows[0], {
        isNewRequest: false,
        reason: 'idempotency_key_match: returning existing analysis request (race)',
      });
    }

    // 6. Update document status -> QUEUED, clear stale worker assignment
    const updatedDoc = await client.query<DocumentRow>(
      `UPDATE documents
         SET analysis_status = 'QUEUED',
             current_stage = 'QUEUED',
             worker_id = NULL
       WHERE id = $1
       RETURNING *`,
      [params.documentId],
    );

    // Update request status -> QUEUED to mirror document state
    const updatedRequest = await client.query<AnalysisRequestRow>(
      `UPDATE document_analysis_requests
         SET status = 'QUEUED'
       WHERE id = $1
       RETURNING *`,
      [analysisRequest.id],
    );

    // 7. Insert outbox event row (same transaction)
    const outboxPayload: AnalysisRequestedOutboxPayload = {
      documentId: params.documentId,
      analysisRequestId: analysisRequest.id,
      userId: params.userId,
      storagePath: doc.storage_path,
      mimeType: doc.mime_type,
      analysisVersion,
    };

    await client.query(
      `INSERT INTO document_pipeline_outbox
         (event_type, aggregate_type, aggregate_id, payload, status)
       VALUES ('analysis.requested', 'document_analysis_request', $1, $2, 'pending')`,
      [analysisRequest.id, JSON.stringify(outboxPayload)],
    );

    // Also write an initial 'queued' pipeline event for SSE/history
    await insertPipelineEvent(client, {
      documentId: params.documentId,
      userId: params.userId,
      eventType: 'queued',
      stage: 'QUEUED',
      message: 'Analysis request queued',
      progress: 0,
      payload: { analysisRequestId: analysisRequest.id },
    });

    return buildResponse(updatedDoc.rows[0], updatedRequest.rows[0], {
      isNewRequest: true,
      reason: 'new_analysis_request_created',
    });
  });
}

function buildResponse(
  doc: DocumentRow,
  request: AnalysisRequestRow,
  dedup: { isNewRequest: boolean; reason: string },
): AnalyzeResponseDto {
  return {
    documentId: doc.id,
    analysisRequestId: request.id,
    currentStatus: doc.analysis_status,
    requestStatus: request.status,
    workerId: doc.worker_id,
    sseUrl: `/documents/${doc.id}/events`,
    deduplication: dedup,
  };
}

/**
 * Shared helper to insert a pipeline event row. Used by this service
 * (for the initial 'queued' event) and by worker stage handlers.
 *
 * NOTE: events are NOT deduplicated by unique constraint by design -
 * the worker uses stage guards (checking documents.analysis_status
 * before emitting) to avoid duplicate emission on retries. See
 * workers/stages/* for the guard pattern.
 */
export async function insertPipelineEvent(
  client: PoolClient,
  event: {
    documentId: string;
    userId: string;
    eventType: string;
    stage: string | null;
    message: string | null;
    progress: number | null;
    payload?: Record<string, unknown> | null;
  },
): Promise<{ id: number }> {
  const result = await client.query<{ id: number }>(
    `INSERT INTO document_pipeline_events
       (document_id, user_id, event_type, stage, message, progress, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      event.documentId,
      event.userId,
      event.eventType,
      event.stage,
      event.message,
      event.progress,
      event.payload ? JSON.stringify(event.payload) : null,
    ],
  );
  return result.rows[0];
}
