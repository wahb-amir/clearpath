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
}
export interface AiAnalysisJobData {
  documentId: string;
  analysisRequestId: string;
  userId: string;
  analysisVersion: string;
}

/** Outbox payload for 'analysis.requested' events. */
export interface AnalysisRequestedOutboxPayload {
  documentId: string;
  analysisRequestId: string;
  userId: string;
  storagePath: string;
  mimeType: string;
  analysisVersion: string;
}
