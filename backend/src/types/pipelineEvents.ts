import type { AnalysisStatus } from './pipelineStatus';

/**
 * Event types streamed via SSE and stored in document_pipeline_events.
 * Maps directly to the pipeline stages requested in the spec.
 */
export const PIPELINE_EVENT_TYPES = [
  'queued',
  'worker_assigned',
  'extraction_started',
  'extraction_progress',
  'ocr_fallback_started',
  'ocr_progress',
  'text_cleaned',
  'language_detected',
  'structure_preserved',
  'chunking_completed',
  'entities_extracted',
  'summary_created',
  'embedding_completed',
  'analysis_completed',
  'failed',
  // meta events for SSE plumbing
  'snapshot',
  'heartbeat',
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
  eventId: number;
}
