import type {
  AnalysisRequestStatus,
  AnalysisStatus,
  DocumentQuality,
  UploadStatus,
} from "./pipelineStatus";

export interface DocumentRow {
  id: string;
  user_id: string;
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  upload_status: UploadStatus;
  analysis_status: AnalysisStatus;
  current_stage: string | null;
  language: string | null;
  ocr_confidence: number | null;
  quality: DocumentQuality;
  extracted_content?: any;
  worker_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRequestRow {
  id: string;
  document_id: string;
  user_id: string;
  idempotency_key: string;
  status: AnalysisRequestStatus;
  worker_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/** Response body for POST /documents/:id/analyze */
export interface AnalyzeResponseDto {
  documentId: string;
  analysisRequestId: string;
  currentStatus: AnalysisStatus;
  requestStatus: AnalysisRequestStatus;
  workerId: string | null;
  sseUrl: string;
  deduplication: {
    isNewRequest: boolean;
    reason: string;
  };
}

/** BullMQ job payload for the analysis queue. */
export interface AnalysisJobData {
  documentId: string;
  analysisRequestId: string;
  userId: string;
  storagePath: string;
  mimeType: string;
  analysisVersion: string;
  pipeline?: "classic" | "agentic";
}
export interface AiAnalysisJobData {
  documentId: string;
  analysisRequestId: string;
  userId: string;
  analysisVersion: string;
  pipeline?: "classic" | "agentic";
}

/** Outbox payload for 'analysis.requested' events. */
export interface AnalysisRequestedOutboxPayload {
  documentId: string;
  analysisRequestId: string;
  userId: string;
  storagePath: string;
  mimeType: string;
  analysisVersion: string;
  pipeline?: "classic" | "agentic";
}

/* ------------------------------------------------------------------ */
/* Atomic per-stage pipeline payloads                                  */
/* ------------------------------------------------------------------ */
/**
 * Every stage job/outbox event carries these identifying + source-file
 * fields forward, plus whatever the previous stage produced. Nothing is
 * held in worker memory between stages - it all flows through the
 * outbox payload (small/structured data) or Supabase Storage (raw text
 * blobs), matching the transactional-outbox pipeline design.
 */
export interface StagePipelineBase {
  documentId: string;
  analysisRequestId: string;
  userId: string;
  storagePath: string;
  mimeType: string;
  analysisVersion: string;
  pipeline?: "classic" | "agentic";
}

/** Emitted by `stage-initialization`; consumed by the Python OCR service. */
export type InitializationCompletedPayload = StagePipelineBase;

/** Emitted by the Python `extract-layout-and-ocr` worker. */
export interface ExtractionCompletedPayload extends StagePipelineBase {
  markdownStoragePath: string;
  ocrConfidence: number;
  textCoverage: number;
}
