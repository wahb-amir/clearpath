import { Client as PgClient } from "pg";
import { pgPool, withTransaction } from "../db/pool";
import { env } from "../config/env";
import { enqueueAiAnalysisJob, enqueueStageJob } from "../queue/analysisQueue";
import { enqueueOcrJob } from "../queue/ocrQueue";
import type {
  AnalysisJobData,
  AnalysisRequestedOutboxPayload,
  InitializationCompletedPayload,
  ExtractionCompletedPayload,
  CleaningCompletedPayload,
  StructuringCompletedPayload,
  ChunkingCompletedPayload,
  EmbeddingCompletedPayload,
  SummarizingCompletedPayload,
} from "../types/dtos";

interface OutboxRow {
  id: number;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  status: "pending" | "sent" | "failed";
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
 * Pipeline stage routing (see docs/pipeline architecture):
 *   analysis.requested        -> stage-initialization        (Node, queue=ANALYSIS_QUEUE_NAME)
 *   document.initialized      -> extract-layout-and-ocr       (Python/Docling, queue=OCR_QUEUE_NAME - isolated)
 *   document.extracted        -> stage-cleaning               (Node, queue=ANALYSIS_QUEUE_NAME)
 *   document.cleaned          -> stage-structuring            (Node)
 *   document.structured       -> stage-chunking               (Node)
 *   document.chunked          -> stage-embedding               (Node)
 *   document.embedded         -> stage-summarizing            (Node)
 *   document.summarized       -> stage-completion             (Node)
 *   document.preprocessing.completed -> ai-analysis           (Node)
 *
 * Each stage job is atomic: it loads what it needs, does its work, and
 * exits. Nothing is held across jobs - the outbox payload IS the state
 * handoff. jobIds are deterministic per (analysisRequestId, stage) so a
 * duplicate dispatch (retry, at-least-once) is deduplicated by BullMQ
 * instead of re-running a stage twice.
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
    await this.listenClient.query("LISTEN outbox_new_event");
    this.listenClient.on("notification", () => {
      void this.dispatchPending();
    });
    this.listenClient.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error(
        "[outbox] LISTEN connection error, relying on polling",
        err,
      );
    });

    // Initial sweep on startup (catches anything queued while we were down)
    void this.dispatchPending();

    // eslint-disable-next-line no-console
    console.log("[outbox] dispatcher started");
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

  private async markSent(rowId: number): Promise<void> {
    await pgPool.query(
      `UPDATE public.document_pipeline_outbox
         SET status = 'sent', processed_at = now()
       WHERE id = $1`,
      [rowId],
    );
  }

  private async dispatchRow(row: OutboxRow): Promise<void> {
    switch (row.event_type) {
      /* ---------------------------------------------------------- */
      /* Entry point: kick off the atomic pipeline at Stage 1        */
      /* ---------------------------------------------------------- */
      case "analysis.requested": {
        const payload = row.payload as AnalysisRequestedOutboxPayload;
        const jobData: AnalysisJobData = {
          documentId: payload.documentId,
          analysisRequestId: payload.analysisRequestId,
          userId: payload.userId,
          storagePath: payload.storagePath,
          mimeType: payload.mimeType,
          analysisVersion: payload.analysisVersion,
        };
        await enqueueStageJob(
          "stage-initialization",
          `${payload.analysisRequestId}-stage-initialization`,
          jobData,
        );
        await this.markSent(row.id);
        break;
      }

      /* ---------------------------------------------------------- */
      /* Stage 1 -> Stage 2 (Python OCR/Docling service)              */
      /* ---------------------------------------------------------- */
      case "document.initialized": {
        const payload = row.payload as InitializationCompletedPayload;
        // Enqueued on the DEDICATED OCR queue (not the shared Node
        // queue) - Node never runs a Worker against this queue name,
        // so there's no possibility of it claiming and rejecting this
        // job. Only the Python ocr-engine service consumes it.
        await enqueueOcrJob(`${payload.analysisRequestId}-extract-layout-and-ocr`, payload);
        await this.markSent(row.id);
        break;
      }

      /* ---------------------------------------------------------- */
      /* Stage 2 -> Stage 3 (written by the Python service itself)   */
      /* ---------------------------------------------------------- */
      case "document.extracted": {
        const payload = row.payload as ExtractionCompletedPayload;
        await enqueueStageJob(
          "stage-cleaning",
          `${payload.analysisRequestId}-stage-cleaning`,
          payload,
        );
        await this.markSent(row.id);
        break;
      }

      /* ---------------------------------------------------------- */
      /* Stage 3 -> Stage 4                                          */
      /* ---------------------------------------------------------- */
      case "document.cleaned": {
        const payload = row.payload as CleaningCompletedPayload;
        await enqueueStageJob(
          "stage-structuring",
          `${payload.analysisRequestId}-stage-structuring`,
          payload,
        );
        await this.markSent(row.id);
        break;
      }

      /* ---------------------------------------------------------- */
      /* Stage 4 -> Stage 5                                          */
      /* ---------------------------------------------------------- */
      case "document.structured": {
        const payload = row.payload as StructuringCompletedPayload;
        await enqueueStageJob(
          "stage-chunking",
          `${payload.analysisRequestId}-stage-chunking`,
          payload,
        );
        await this.markSent(row.id);
        break;
      }

      /* ---------------------------------------------------------- */
      /* Stage 5 -> Stage 6                                          */
      /* ---------------------------------------------------------- */
      case "document.chunked": {
        const payload = row.payload as ChunkingCompletedPayload;
        await enqueueStageJob(
          "stage-embedding",
          `${payload.analysisRequestId}-stage-embedding`,
          payload,
        );
        await this.markSent(row.id);
        break;
      }

      /* ---------------------------------------------------------- */
      /* Stage 6 -> Stage 7                                          */
      /* ---------------------------------------------------------- */
      case "document.embedded": {
        const payload = row.payload as EmbeddingCompletedPayload;
        await enqueueStageJob(
          "stage-summarizing",
          `${payload.analysisRequestId}-stage-summarizing`,
          payload,
        );
        await this.markSent(row.id);
        break;
      }

      /* ---------------------------------------------------------- */
      /* Stage 7 -> Stage 8                                          */
      /* ---------------------------------------------------------- */
      case "document.summarized": {
        const payload = row.payload as SummarizingCompletedPayload;
        await enqueueStageJob(
          "stage-completion",
          `${payload.analysisRequestId}-stage-completion`,
          payload,
        );
        await this.markSent(row.id);
        break;
      }

      /* ---------------------------------------------------------- */
      /* Stage 8 (preprocessing done) -> AI analysis - unchanged      */
      /* ---------------------------------------------------------- */
      case "document.preprocessing.completed": {
        const payload = row.payload as {
          documentId: string;
          userId: string;
          analysisRequestId: string;
          analysisVersion: string;
        };

        await enqueueAiAnalysisJob(`ai:${payload.analysisRequestId}`, payload);
        await this.markSent(row.id);
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
    const newStatus =
      nextRetryCount >= env.OUTBOX_MAX_RETRIES ? "failed" : "pending";

    console.error(
      `[outbox] dispatch failed for outbox row ${row.id} (attempt ${nextRetryCount}):`,
      err,
    );

    // FIX: Explicitly cast $2 to your enum type
    await pgPool.query(
      `UPDATE public.document_pipeline_outbox
         SET retry_count = $1, 
             status = $2::outbox_status, 
             processed_at = CASE WHEN $2::outbox_status = 'failed'::outbox_status THEN now() ELSE processed_at END
       WHERE id = $3`,
      [nextRetryCount, newStatus, row.id],
    );
  }
}

export const outboxDispatcher = new OutboxDispatcher();
