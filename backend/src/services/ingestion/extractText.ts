import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { env } from '../../config/env';
import { ExtractionFailedError } from '../../types/errors';
import { rasterizePdfPage, runTesseractOcr } from './ocrProvider';
import type { DetectedFileCategory } from '../../workers/stages/detectFileType';

const execFileAsync = promisify(execFile);

export interface ExtractionResult {
  rawText: string;
  /** 'embedded' for PDFs with extractable text, 'ocr' for image/OCR-based extraction */
  method: 'embedded' | 'ocr' | 'plain_text';
  /** Mean OCR confidence if OCR was used; 1.0 for embedded/plain text */
  ocrConfidence: number;
  /** Fraction of pages/content that had usable text before any OCR fallback */
  textCoverage: number;
  pagesProcessed: number;
  /** true if any page required OCR fallback */
  usedOcrFallback: boolean;
}

/**
 * Extracts embedded text from a PDF using `pdftotext` (poppler-utils).
 * Returns per-page text so the caller can decide which pages need OCR.
 *
 * Setup: apt-get install -y poppler-utils
 */
async function extractPdfEmbeddedText(pdfBuffer: Buffer): Promise<{
  pages: string[];
}> {
  const dir = await mkdtemp(path.join(tmpdir(), 'pdftext-'));
  const inputPath = path.join(dir, 'input.pdf');

  try {
    await writeFile(inputPath, pdfBuffer);
    // -layout preserves columns/whitespace better for structure detection later
    const { stdout } = await execFileAsync(
      'pdftotext',
      ['-layout', inputPath, '-'],
      { maxBuffer: 1024 * 1024 * 64, encoding: 'utf-8' },
    );

    // pdftotext separates pages with form-feed characters (\f)
    const pages = stdout.split('\f').map((p) => p.trimEnd());
    // Remove trailing empty page often produced after the last \f
    while (pages.length > 1 && pages[pages.length - 1].trim() === '') {
      pages.pop();
    }
    return { pages };
  } catch (err) {
    throw new ExtractionFailedError('pdftotext extraction failed', {
      cause: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Returns the count of "real" word-like tokens, used for sparsity checks. */
function countWords(text: string): number {
  return (text.match(/[A-Za-z0-9\u0600-\u06FF]{2,}/g) ?? []).length;
}

/**
 * Main extraction entry point. Routes by detected file category.
 *
 * For PDFs:
 *  - extracts embedded text per page via pdftotext
 *  - for pages with sparse text (< threshold word count), rasterizes
 *    and OCRs that page, replacing its text
 *  - aggregates an overall ocrConfidence and textCoverage
 *
 * For images (screenshots/scans/photos): straight to OCR.
 * For plain text files: passthrough (caller provides the buffer as text).
 */
export async function extractText(params: {
  fileBuffer: Buffer;
  category: DetectedFileCategory;
  mimeType: string;
  onPageProgress?: (current: number, total: number) => Promise<void>;
}): Promise<ExtractionResult> {
  const { fileBuffer, category, onPageProgress } = params;

  if (category === 'text') {
    const text = fileBuffer.toString('utf-8');
    return {
      rawText: text,
      method: 'plain_text',
      ocrConfidence: 1,
      textCoverage: 1,
      pagesProcessed: 1,
      usedOcrFallback: false,
    };
  }

  if (category === 'screenshot_or_scan' || category === 'photo') {
    const ocr = await runTesseractOcr(fileBuffer);
    if (onPageProgress) await onPageProgress(1, 1);
    return {
      rawText: ocr.text,
      method: 'ocr',
      ocrConfidence: ocr.confidence,
      textCoverage: ocr.text.trim().length > 0 ? 1 : 0,
      pagesProcessed: 1,
      usedOcrFallback: true,
    };
  }

  // category === 'pdf'
  const { pages } = await extractPdfEmbeddedText(fileBuffer);
  const totalPages = Math.max(pages.length, 1);

  const finalPages: string[] = [];
  const confidences: number[] = [];
  let usedOcrFallback = false;
  let pagesWithText = 0;

  const MIN_WORDS_PER_PAGE = 10; // below this, treat as sparse -> OCR fallback

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i] ?? '';
    const wordCount = countWords(pageText);

    if (wordCount >= MIN_WORDS_PER_PAGE) {
      finalPages.push(pageText);
      confidences.push(1);
      pagesWithText += 1;
    } else {
      // Sparse text -> OCR fallback for this page
      usedOcrFallback = true;
      try {
        const image = await rasterizePdfPage(fileBuffer, i + 1);
        const ocr = await runTesseractOcr(image);
        finalPages.push(ocr.text);
        confidences.push(ocr.confidence);
        if (ocr.text.trim().length > 0) pagesWithText += 1;
      } catch {
        // If OCR also fails for this page, keep whatever sparse text we had
        finalPages.push(pageText);
        confidences.push(0);
      }
    }

    if (onPageProgress) await onPageProgress(i + 1, totalPages);
  }

  const ocrConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 1;

  return {
    rawText: finalPages.join('\n\n'),
    method: usedOcrFallback ? 'ocr' : 'embedded',
    ocrConfidence,
    textCoverage: pagesWithText / totalPages,
    pagesProcessed: totalPages,
    usedOcrFallback,
  };
}

export { env as _envForTests }; // re-export to keep import side-effects predictable
