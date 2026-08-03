import { UnsupportedFileTypeError } from "../../types/errors";

export type DetectedFileCategory =
  | "pdf"
  | "screenshot_or_scan"
  | "photo"
  | "text";

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/tiff",
  "image/bmp",
]);

function normalizeMimeType(mimeType: string): string {
  return mimeType.trim().toLowerCase();
}

export function detectFileCategory(mimeType: string): DetectedFileCategory {
  const normalizedMimeType = normalizeMimeType(mimeType);

  switch (normalizedMimeType) {
    case "application/pdf":
      return "pdf";

    default:
      if (TEXT_MIME_TYPES.has(normalizedMimeType)) {
        return "text";
      }

      if (IMAGE_MIME_TYPES.has(normalizedMimeType)) {
        return "screenshot_or_scan";
      }

      throw new UnsupportedFileTypeError(normalizedMimeType);
  }
}