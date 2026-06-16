import { UnsupportedFileTypeError } from '../../types/errors';

export type DetectedFileCategory =
  | 'pdf'
  | 'screenshot_or_scan'
  | 'photo'
  | 'text'
  | 'unsupported';

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]);

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/tiff',
  'image/bmp',
]);

/**
 * Detects the broad file category from MIME type (and, for images,
 * leaves the screenshot-vs-photo distinction to the OCR stage, which
 * can use heuristics like aspect ratio / text density after a quick
 * OCR pass - both ultimately go through the OCR path here).
 */
export function detectFileCategory(mimeType: string): DetectedFileCategory {
  const mime = mimeType.toLowerCase();

  if (mime === 'application/pdf') return 'pdf';
  if (TEXT_MIME_TYPES.has(mime)) return 'text';
  if (IMAGE_MIME_TYPES.has(mime)) return 'screenshot_or_scan';

  throw new UnsupportedFileTypeError(mimeType);
}
