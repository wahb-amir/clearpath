import type { PoolClient } from "pg";
import { pgPool, withTransaction } from "../db/pool";
import {
  createPublisherConnection,
  channelForDocument,
} from "../redis/connection";
import { insertPipelineEvent } from "../services/analysisRequestService";
import {
  isValidTransition,
  type AnalysisStatus,
} from "../types/pipelineStatus";
import { InvalidStateTransitionError } from "../types/errors";
import type { PipelineEventType } from "../types/pipelineEvents";

const publisher = createPublisherConnection();

/**
 * Atomically:
 *  - validates the requested status transition
 *  - updates documents.analysis_status / current_stage / worker_id
 *  - inserts a document_pipeline_events row
 *  - publishes a lightweight Redis notification
 *
 * This is the SINGLE function workers should call to report progress.
 * Postgres is updated first (source of truth); Redis notify is
 * best-effort (SSE replay from Postgres covers any missed messages).
 */
export async function reportStage(params: {
  documentId: string;
  userId: string;
  workerId: string;
  toStatus: AnalysisStatus;
  eventType: PipelineEventType;
  message?: string;
  progress?: number;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const eventId = await withTransaction(async (client) => {
    const current = await client.query<{ analysis_status: AnalysisStatus }>(
      `SELECT analysis_status FROM documents WHERE id = $1 FOR UPDATE`,
      [params.documentId],
    );

    if (current.rowCount === 0) {
      throw new Error(
        `Document ${params.documentId} not found while reporting stage`,
      );
    }

    const fromStatus = current.rows[0].analysis_status;

    if (!isValidTransition(fromStatus, params.toStatus)) {
      throw new InvalidStateTransitionError(fromStatus, params.toStatus);
    }

    await client.query(
      `UPDATE documents
         SET analysis_status = $1, current_stage = $2, worker_id = $3
       WHERE id = $4`,
      [params.toStatus, params.toStatus, params.workerId, params.documentId],
    );

    const event = await insertPipelineEvent(client, {
      documentId: params.documentId,
      userId: params.userId,
      eventType: params.eventType,
      stage: params.toStatus,
      message: params.message ?? null,
      progress: params.progress ?? null,
      payload: params.payload ?? null,
    });

    return event.id;
  });

  // Best-effort live push
  try {
    await publisher.publish(
      channelForDocument(params.documentId),
      JSON.stringify({ documentId: params.documentId, eventId }),
    );
  } catch {
    // Redis publish failure is non-fatal - SSE clients will pick up via
    // their periodic Postgres replay / next successful notification.
  }
}

/**
 * Emits a progress-only event WITHOUT changing analysis_status (e.g.
 * "extraction_progress" while remaining in EXTRACTING). Use this for
 * intra-stage progress ticks.
 */
export async function reportProgress(params: {
  documentId: string;
  userId: string;
  stage: AnalysisStatus;
  eventType: PipelineEventType;
  message?: string;
  progress: number;
  payload?: Record<string, unknown>;
}): Promise<void> {
  let eventId: number;

  const client = await pgPool.connect();
  try {
    const event = await insertPipelineEvent(client, {
      documentId: params.documentId,
      userId: params.userId,
      eventType: params.eventType,
      stage: params.stage,
      message: params.message ?? null,
      progress: params.progress,
      payload: params.payload ?? null,
    });
    eventId = event.id;
  } finally {
    client.release();
  }

  try {
    await publisher.publish(
      channelForDocument(params.documentId),
      JSON.stringify({ documentId: params.documentId, eventId }),
    );
  } catch {
    // non-fatal
  }
}

/**
 * Marks the document & analysis request as FAILED, writes a 'failed'
 * event with the error payload. Used by the worker's top-level
 * catch block.
 */
export async function reportFailure(params: {
  documentId: string;
  analysisRequestId: string;
  userId: string;
  workerId: string;
  error: unknown;
}): Promise<void> {
  const message =
    params.error instanceof Error ? params.error.message : String(params.error);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE documents
         SET analysis_status = 'FAILED', current_stage = 'FAILED', worker_id = $1
       WHERE id = $2`,
      [params.workerId, params.documentId],
    );

    await client.query(
      `UPDATE document_analysis_requests
         SET status = 'FAILED', error_message = $1, finished_at = now()
       WHERE id = $2`,
      [message, params.analysisRequestId],
    );

    const event = await insertPipelineEvent(client, {
      documentId: params.documentId,
      userId: params.userId,
      eventType: "failed",
      stage: "FAILED",
      message,
      progress: null,
      payload: { error: message },
    });

    return event.id;
  });

  try {
    await publisher.publish(
      channelForDocument(params.documentId),
      JSON.stringify({ documentId: params.documentId, eventId: -1 }),
    );
  } catch {
    // non-fatal
  }
}

export async function withPgClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pgPool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
