import { fileTypeFromBuffer } from "file-type";
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
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export async function detectFileCategory(
  buffer: Buffer,
): Promise<DetectedFileCategory> {
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    throw new UnsupportedFileTypeError("Unknown file type");
  }

  switch (detected.mime) {
    case "application/pdf":
      return "pdf";

    default:
      if (TEXT_MIME_TYPES.has(detected.mime)) {
        return "text";
      }

      if (IMAGE_MIME_TYPES.has(detected.mime)) {
        return "screenshot_or_scan";
      }

      throw new UnsupportedFileTypeError(detected.mime);
  }
}