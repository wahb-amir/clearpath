import type { AnalysisStatus } from "./pipelineStatus";

/**
 * Event types streamed via SSE and stored in document_pipeline_events.
 * Maps directly to the pipeline stages requested in the spec.
 */
export const PIPELINE_EVENT_TYPES = [
  "queued",
  "worker_assigned",
  "extraction_started",
  "extraction_progress",
  "ocr_fallback_started",
  "ocr_progress",
  "text_cleaned",
  "language_detected",
  "structure_preserved",
  "entities_extracted",
  "chunking_completed",
  "embedding_completed",
  "summary_created",

  "preprocessing_completed",

  "extraction_awaiting_verification",
  "extraction_draft_updated",
  "extraction_verified",

  "ai_analysis_queued",
  "ai_analysis_started",

  "ai_understanding_started",
  "ai_understanding_completed",

  "ai_extraction_started",
  "ai_extraction_completed",

  "ai_verification_started",
  "ai_verification_completed",

  "ai_synthesis_started",

  "ai_summary_delta",

  "ai_human_review_required",

  "ai_completed",

  "analysis_completed",
  "analysis_failed",
  "heartbeat",
  "snapshot",
] as const;

export type PipelineEventType = (typeof PIPELINE_EVENT_TYPES)[number];

export interface PipelineEventPayload {
  [key: string]: unknown;
}

export interface PipelineEventRecord {
  id: number; // bigserial - used as SSE event id / cursor
  documentId: string;
  userId: string;
  eventType: PipelineEventType;
  stage: AnalysisStatus | null;
  message: string | null;
  progress: number | null;
  payload: PipelineEventPayload | null;
  createdAt: string;
}

/** Lightweight notification published over Redis pub/sub. */
export interface PipelineNotification {
  documentId: string;
  eventId?: number;
  ephemeral?: boolean;
  eventRecord?: PipelineEventRecord;
}
