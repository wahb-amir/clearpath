/**
 * Shared test fixtures and helpers for worker stage tests.
 *
 * All external dependencies (DB, Redis, Supabase, AI services) are stubbed here
 * so individual tests stay focused on the stage logic itself.
 */

import type { Job } from "bullmq";
import type { AnalysisJobData, DocumentRow } from "../../types/dtos";
import type { AnalysisState } from "../stages/types";
import type { AnalysisStatus } from "../../types/pipelineStatus";

// ---------------------------------------------------------------------------
// Minimal BullMQ Job mock
// ---------------------------------------------------------------------------
export function makeJob(
  overrides: Partial<AnalysisJobData> = {},
): Job<AnalysisJobData> {
  const data: AnalysisJobData = {
    documentId: "doc-123",
    analysisRequestId: "req-456",
    userId: "user-789",
    storagePath: "uploads/user-789/doc-123.pdf",
    mimeType: "application/pdf",
    analysisVersion: "v1",
    ...overrides,
  };
  return { id: "job-001", data } as unknown as Job<AnalysisJobData>;
}

// ---------------------------------------------------------------------------
// Minimal DocumentRow mock
// ---------------------------------------------------------------------------
export function makeDoc(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "doc-123",
    user_id: "user-789",
    storage_path: "uploads/user-789/doc-123.pdf",
    original_file_name: "contract.pdf",
    mime_type: "application/pdf",
    file_size: 102400,
    upload_status: "UPLOADED",
    analysis_status: "QUEUED",
    current_stage: null,
    language: null,
    ocr_confidence: null,
    quality: "unknown",
    extracted_content: undefined,
    worker_id: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Minimal AnalysisState builder
// ---------------------------------------------------------------------------
export function makeState(
  overrides: Partial<AnalysisState> & {
    status?: AnalysisStatus;
    jobOverrides?: Partial<AnalysisJobData>;
    docOverrides?: Partial<DocumentRow>;
  } = {},
): AnalysisState {
  const { status, jobOverrides, docOverrides, ...rest } = overrides;

  const doc = makeDoc({
    analysis_status: status ?? "QUEUED",
    ...docOverrides,
  });

  return {
    job: makeJob(jobOverrides),
    doc,
    workerId: "worker-001",
    currentStatus: status ?? "QUEUED",
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// Sample extracted content stored in doc.extracted_content after verification
// ---------------------------------------------------------------------------
export const SAMPLE_EXTRACTED_CONTENT = {
  title: "Service Agreement",
  summary: "A contract between two parties",
  language: "English",
  quality: "good",
  ocrConfidence: 1,
  extractionMethod: "embedded",
  sections: [
    {
      index: 0,
      title: "Introduction",
      content: "This agreement is between...",
    },
    { index: 1, title: "Terms", content: "The terms are as follows..." },
  ],
  dates: [
    {
      value: "2024-03-01",
      normalizedValue: "2024-03-01",
      factType: "date",
      context: "effective date",
      confidence: 0.9,
    },
  ],
  contacts: [
    {
      value: "legal@example.com",
      factType: "email",
      context: "contact email",
      confidence: 0.95,
    },
  ],
  amounts: [{ value: "$5,000", context: "monthly payment", confidence: 0.85 }],
  referenceIds: [
    { value: "AGR-2024-001", context: "agreement number", confidence: 0.99 },
  ],
  rawTextPreview: "This agreement is between...",
};
