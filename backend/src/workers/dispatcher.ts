import { Client as PgClient } from 'pg';
import { pgPool, withTransaction } from '../db/pool';
import { env } from '../config/env';
import { enqueueAnalysisJob } from '../queue/analysisQueue';
import { jobIdForAnalysisRequest } from '../utils/idempotency';
import type {
  AnalysisJobData,
  AnalysisRequestedOutboxPayload,
} from '../types/dtos';

interface OutboxRow {
  id: number;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: AnalysisRequestedOutboxPayload;
  status: 'pending' | 'sent' | 'failed';
  retry_count: number;
}

/**
 * Transactional Outbox Dispatcher
 * --------------------------------
 * Reads 'pending' rows from document_pipeline_outbox and enqueues the
 * corresponding BullMQ job. Marks the row 'sent' ONLY after the
 * enqueue call succeeds. If enqueue throws, increments retry_count and
 * leaves status='pending' (or moves to 'failed' after max retries for
 * manual inspection / DLQ).
 *
 * Two trigger mechanisms, both active:
 *  1. LISTEN/NOTIFY - near-instant dispatch after INSERT (see migration
 *     trigger `trg_notify_outbox_insert`)
 *  2. Polling loop - safety net for missed notifications (e.g. dispatcher
 *     was down when the NOTIFY fired) and for retrying failed rows.
 *
 * Run this as a long-lived process (e.g. `npm run dispatcher` as a
 * separate PM2/Docker process), or alongside the API server in dev.
 */
export class OutboxDispatcher {
  private pollTimer: NodeJS.Timeout | null = null;
  private listenClient: PgClient | null = null;
  private running = false;
  private dispatchInFlight = false;

  async start(): Promise<void> {
    this.running = true;

    // Polling fallback
    this.pollTimer = setInterval(() => {
      void this.dispatchPending();
    }, env.OUTBOX_POLL_INTERVAL_MS);

    // LISTEN/NOTIFY for low-latency dispatch
    this.listenClient = new PgClient({ connectionString: env.DATABASE_URL });
    await this.listenClient.connect();
    await this.listenClient.query('LISTEN outbox_new_event');
    this.listenClient.on('notification', () => {
      void this.dispatchPending();
    });
    this.listenClient.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[outbox] LISTEN connection error, relying on polling', err);
    });

    // Initial sweep on startup (catches anything queued while we were down)
    void this.dispatchPending();

    // eslint-disable-next-line no-console
    console.log('[outbox] dispatcher started');
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.listenClient) await this.listenClient.end();
  }

  /**
   * Reads and processes pending outbox rows. Safe to call concurrently
   * (guarded by `dispatchInFlight`) and idempotent: each row is only
   * marked 'sent' after a successful enqueue, and BullMQ's jobId dedup
   * means re-processing an already-sent row's job (if status update
   * failed after enqueue) does not create a duplicate job.
   */
  async dispatchPending(): Promise<{ processed: number; failed: number }> {
    if (!this.running || this.dispatchInFlight) {
      return { processed: 0, failed: 0 };
    }
    this.dispatchInFlight = true;

    let processed = 0;
    let failed = 0;

    try {
      // Lock and fetch a batch of pending rows
      const rows = await withTransaction<OutboxRow[]>(async (client) => {
        const result = await client.query<OutboxRow>(
          `SELECT * FROM public.document_pipeline_outbox
             WHERE status = 'pending' AND retry_count < $1
             ORDER BY created_at ASC
             LIMIT 50
             FOR UPDATE SKIP LOCKED`,
          [env.OUTBOX_MAX_RETRIES],
        );
        return result.rows;
      });

      for (const row of rows) {
        try {
          await this.dispatchRow(row);
          processed += 1;
        } catch (err) {
          failed += 1;
          await this.markRetry(row, err);
        }
      }
    } finally {
      this.dispatchInFlight = false;
    }

    return { processed, failed };
  }

  private async dispatchRow(row: OutboxRow): Promise<void> {
    switch (row.event_type) {
      case 'analysis.requested': {
        const payload = row.payload;
        const jobData: AnalysisJobData = {
          documentId: payload.documentId,
          analysisRequestId: payload.analysisRequestId,
          userId: payload.userId,
          storagePath: payload.storagePath,
          mimeType: payload.mimeType,
          analysisVersion: payload.analysisVersion,
        };
        const jobId = jobIdForAnalysisRequest(payload.analysisRequestId);

        // Enqueue FIRST - only mark 'sent' if this succeeds
        await enqueueAnalysisJob(jobId, jobData);

        await pgPool.query(
          `UPDATE public.document_pipeline_outbox
             SET status = 'sent', processed_at = now()
           WHERE id = $1`,
          [row.id],
        );
        break;
      }
      default:
        // Unknown event type - mark failed immediately, don't retry forever
        await pgPool.query(
          `UPDATE public.document_pipeline_outbox
             SET status = 'failed', processed_at = now()
           WHERE id = $1`,
          [row.id],
        );
    }
  }

  private async markRetry(row: OutboxRow, err: unknown): Promise<void> {
    const nextRetryCount = row.retry_count + 1;
    const newStatus = nextRetryCount >= env.OUTBOX_MAX_RETRIES ? 'failed' : 'pending';

    // eslint-disable-next-line no-console
    console.error(
      `[outbox] dispatch failed for outbox row ${row.id} (attempt ${nextRetryCount}):`,
      err,
    );

    await pgPool.query(
      `UPDATE public.document_pipeline_outbox
         SET retry_count = $1, status = $2, processed_at = CASE WHEN $2 = 'failed' THEN now() ELSE processed_at END
       WHERE id = $3`,
      [nextRetryCount, newStatus, row.id],
    );
  }
}

export const outboxDispatcher = new OutboxDispatcher();