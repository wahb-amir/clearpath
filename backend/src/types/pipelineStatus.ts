/**
 * Status model and valid state transitions for `documents.analysis_status`
 * and `document_analysis_requests.status`.
 */

export const ANALYSIS_STATUSES = [
  "NOT_STARTED",
  "QUEUED",
  "PROCESSING",
  "EXTRACTING",
  "OCRING",
  "CLEANING",
  "STRUCTURING",
  "CHUNKING",
  "EMBEDDING",
  "SUMMARIZING",
  "PREPROCESSING_COMPLETED",
  "AI_QUEUED",
  "AI_PROCESSING",
  "AI_COMPLETED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const ANALYSIS_REQUEST_STATUSES = [
  "PENDING",
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type AnalysisRequestStatus = (typeof ANALYSIS_REQUEST_STATUSES)[number];

export const UPLOAD_STATUSES = [
  "PENDING_UPLOAD",
  "UPLOADED",
  "FAILED",
] as const;
export type UploadStatus = (typeof UPLOAD_STATUSES)[number];

export const DOCUMENT_QUALITIES = [
  "good",
  "medium",
  "poor",
  "unknown",
] as const;
export type DocumentQuality = (typeof DOCUMENT_QUALITIES)[number];

/**
 * Allowed forward transitions for documents.analysis_status.
 * FAILED and CANCELLED are reachable from any "in-flight" state.
 * COMPLETED is terminal; NOT_STARTED can move to QUEUED (analyze trigger)
 * or back to NOT_STARTED is never valid once queued (must go through
 * FAILED/CANCELLED first, then a new analysis request resets to QUEUED).
 */
const IN_FLIGHT_STATUSES: AnalysisStatus[] = [
  "QUEUED",
  "PROCESSING",
  "EXTRACTING",
  "OCRING",
  "CLEANING",
  "STRUCTURING",
  "CHUNKING",
  "EMBEDDING",
  "SUMMARIZING",
];

const PIPELINE_ORDER: AnalysisStatus[] = [
  "QUEUED",
  "PROCESSING",
  "EXTRACTING",
  "OCRING",
  "CLEANING",
  "STRUCTURING",
  "CHUNKING",
  "EMBEDDING",
  "SUMMARIZING",
  "COMPLETED",
];

const ALLOWED_TRANSITIONS: Record<AnalysisStatus, AnalysisStatus[]> = {
  NOT_STARTED: ["QUEUED"],
  QUEUED: ["PROCESSING"],
  PROCESSING: ["EXTRACTING"],
  EXTRACTING: ["OCRING", "CLEANING"],
  OCRING: ["CLEANING"],
  CLEANING: ["STRUCTURING"],
  STRUCTURING: ["CHUNKING"],
  CHUNKING: ["EMBEDDING"],
  EMBEDDING: ["SUMMARIZING"],
  SUMMARIZING: ["PREPROCESSING_COMPLETED"],
  PREPROCESSING_COMPLETED: ["AI_QUEUED", "AI_PROCESSING"],
  AI_QUEUED: ["AI_PROCESSING"],
  AI_PROCESSING: ["AI_COMPLETED"],
  AI_COMPLETED: ["COMPLETED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isValidTransition(
  from: AnalysisStatus,
  to: AnalysisStatus,
): boolean {
  if (from === to) return true; // idempotent no-op transition allowed (stage guard)
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isInFlight(status: AnalysisStatus): boolean {
  return IN_FLIGHT_STATUSES.includes(status);
}

export function isTerminal(status: AnalysisStatus): boolean {
  return (
    status === "COMPLETED" || status === "FAILED" || status === "CANCELLED"
  );
}

/**
 * Returns the index of a status within the linear pipeline order, or -1
 * if it's not part of the main forward pipeline (e.g. FAILED/CANCELLED).
 * Used by the worker to decide whether a stage has already been passed
 * (resumability / skip-completed-stages).
 */
export function pipelineIndex(status: AnalysisStatus): number {
  return PIPELINE_ORDER.indexOf(status);
}

export function isStageCompleteOrPast(
  currentStatus: AnalysisStatus,
  stage: AnalysisStatus,
): boolean {
  const current = pipelineIndex(currentStatus);
  const target = pipelineIndex(stage);
  if (current === -1 || target === -1) return false;
  return current > target;
}
