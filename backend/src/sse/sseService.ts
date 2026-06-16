import type { Response } from 'express';
import { pgPool } from '../db/pool';
import { createSubscriberConnection, channelForDocument } from '../redis/connection';
import { env } from '../config/env';
import type { PipelineEventRecord, PipelineNotification } from '../types/pipelineEvents';
import type { DocumentRow } from '../types/dtos';

interface PipelineEventDbRow {
  id: number;
  document_id: string;
  user_id: string;
  event_type: string;
  stage: string | null;
  message: string | null;
  progress: number | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

function toEventRecord(row: PipelineEventDbRow): PipelineEventRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    userId: row.user_id,
    eventType: row.event_type as PipelineEventRecord['eventType'],
    stage: row.stage as PipelineEventRecord['stage'],
    message: row.message,
    progress: row.progress,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

/** Writes a single SSE frame: id, event, data, with trailing blank line. */
function writeSseEvent(res: Response, record: PipelineEventRecord): void {
  res.write(`id: ${record.id}\n`);
  res.write(`event: ${record.eventType}\n`);
  res.write(
    `data: ${JSON.stringify({
      documentId: record.documentId,
      stage: record.stage,
      message: record.message,
      progress: record.progress,
      payload: record.payload,
      createdAt: record.createdAt,
    })}\n\n`,
  );
}

function writeSseComment(res: Response, comment: string): void {
  res.write(`: ${comment}\n\n`);
}

/**
 * Streams pipeline events for a document via SSE.
 *
 * Flow:
 *  1. Send current document snapshot immediately (event: snapshot)
 *  2. Replay any events with id > lastEventId from Postgres
 *     (covers reconnects: client sends Last-Event-ID header)
 *  3. Subscribe to Redis pub/sub channel for this document for
 *     near-real-time pushes
 *  4. On each Redis notification, fetch the new event(s) from Postgres
 *     by id (Postgres remains source of truth - Redis is just a "wake
 *     up and check" signal, avoiding missed-message issues if Redis
 *     drops a message)
 *  5. Heartbeat ping every SSE_HEARTBEAT_INTERVAL_MS
 *  6. Clean up subscriber + timers on client disconnect
 */
export async function streamDocumentEvents(params: {
  res: Response;
  documentId: string;
  userId: string;
  lastEventId: number | null;
}): Promise<void> {
  const { res, documentId, userId, lastEventId } = params;

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering for real-time delivery
  });
  res.flushHeaders?.();

  let lastSentEventId = lastEventId ?? 0;
  let closed = false;

  // 1. Send snapshot
  const docResult = await pgPool.query<DocumentRow>(
    `SELECT * FROM documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId],
  );

  if (docResult.rowCount === 0) {
    writeSseComment(res, 'document not found or access denied');
    res.end();
    return;
  }

  const doc = docResult.rows[0];
  writeSseEvent(res, {
    id: 0,
    documentId: doc.id,
    userId,
    eventType: 'snapshot',
    stage: doc.analysis_status,
    message: 'Current document state',
    progress: null,
    payload: {
      analysisStatus: doc.analysis_status,
      uploadStatus: doc.upload_status,
      currentStage: doc.current_stage,
      quality: doc.quality,
      language: doc.language,
      ocrConfidence: doc.ocr_confidence,
      workerId: doc.worker_id,
    },
    createdAt: new Date().toISOString(),
  });

  // 2. Replay missed events
  await replayEvents();

  // 3. Subscribe to Redis for live pushes
  const subscriber = createSubscriberConnection();
  const channel = channelForDocument(documentId);
  await subscriber.subscribe(channel);

  subscriber.on('message', (_chan, message) => {
    if (closed) return;
    try {
      const notification: PipelineNotification = JSON.parse(message);
      if (notification.documentId !== documentId) return;
      void replayEvents();
    } catch {
      // ignore malformed notifications
    }
  });

  // 5. Heartbeat
  const heartbeat = setInterval(() => {
    if (closed) return;
    writeSseComment(res, 'heartbeat');
  }, env.SSE_HEARTBEAT_INTERVAL_MS);

  // 6. Cleanup
  const cleanup = async () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    try {
      await subscriber.unsubscribe(channel);
      subscriber.disconnect();
    } catch {
      // ignore
    }
  };

  res.on('close', () => void cleanup());
  res.on('error', () => void cleanup());

  /**
   * Fetches and writes all events with id > lastSentEventId, in order.
   * Re-invoked on every Redis notification and once at connection start
   * for replay - Postgres ordering guarantees correctness even if
   * multiple notifications arrive for the same underlying events.
   */
  async function replayEvents(): Promise<void> {
    if (closed) return;
    const result = await pgPool.query<PipelineEventDbRow>(
      `SELECT * FROM document_pipeline_events
         WHERE document_id = $1 AND user_id = $2 AND id > $3
         ORDER BY id ASC
         LIMIT 200`,
      [documentId, userId, lastSentEventId],
    );

    for (const row of result.rows) {
      if (closed) return;
      const record = toEventRecord(row);
      writeSseEvent(res, record);
      lastSentEventId = record.id;
    }
  }
}
