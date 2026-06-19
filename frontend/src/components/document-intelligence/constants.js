export const EVENT_LABELS = {
  snapshot: "Snapshot",
  queued: "Queued",
  worker_assigned: "Worker assigned",
  extraction_started: "Extraction started",
  extraction_progress: "Extraction progress",
  text_cleaned: "Text cleaned",
  language_detected: "Language detected",
  structure_preserved: "Structure preserved",
  chunking_completed: "Chunking completed",
  embedding_completed: "Embedding completed",
  summary_created: "Summary created",
  analysis_completed: "Analysis completed",
  failed: "Failed",
  heartbeat: "Heartbeat",
};

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export function stageToProgress(stage) {
  switch (stage) {
    case "QUEUED":
      return 0;
    case "PROCESSING":
      return 5;
    case "EXTRACTING":
      return 15;
    case "CLEANING":
      return 35;
    case "STRUCTURING":
      return 45;
    case "CHUNKING":
      return 60;
    case "EMBEDDING":
      return 80;
    case "SUMMARIZING":
      return 90;
    case "COMPLETED":
      return 100;
    case "FAILED":
      return 100;
    default:
      return 0;
  }
}

export function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 1) return "now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function isAcceptedDocumentFile(file) {
  if (!file) return false;
  const name = file.name.toLowerCase();

  return (
    ACCEPTED_MIME_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
  );
}
