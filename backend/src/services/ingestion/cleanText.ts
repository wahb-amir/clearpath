/**
 * Cleans raw extracted text:
 *  - collapses duplicate whitespace (within lines, not across paragraph breaks)
 *  - removes common OCR artifact characters
 *  - fixes broken line endings (hyphenated word wraps: "exam-\nple" -> "example")
 *  - normalizes bullet/list markers
 *  - optionally corrects obvious low-confidence spelling distortions
 *    (only applied conservatively, see correctObviousOcrErrors)
 *
 * Paragraph boundaries (double newlines) and heading-like lines are
 * preserved so the structuring stage can operate on them.
 */

const OCR_ARTIFACT_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g;

// Common OCR mis-recognitions that are safe to fix in isolation
const SAFE_OCR_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bteh\b/g, 'the'],
  [/\bhte\b/g, 'the'],
  [/\b1l\b/g, 'll'],
  [/(\w)\u00ad(\n)/g, '$1$2'], // soft hyphen before newline
];

export interface CleanTextResult {
  cleanText: string;
  /** Whether any spelling corrections were applied (for transparency in summary) */
  correctionsApplied: boolean;
}

export function cleanExtractedText(rawText: string, ocrConfidence: number): CleanTextResult {
  let text = rawText;

  // 1. Remove control characters / artifact glyphs
  text = text.replace(OCR_ARTIFACT_CHARS, '');

  // 2. Fix hyphenated line-wrap breaks: "exam-\nple" -> "example"
  text = text.replace(/(\w)-\n(\w)/g, '$1$2');

  // 3. Normalize Windows/Mac line endings
  text = text.replace(/\r\n?/g, '\n');

  // 4. Collapse 3+ blank lines to a single paragraph break
  text = text.replace(/\n{3,}/g, '\n\n');

  // 5. Collapse repeated horizontal whitespace within a line (preserve newlines)
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n');

  // 6. Normalize common bullet glyphs to a consistent marker
  text = text.replace(/^[\s]*[•●▪◦·]\s*/gm, '- ');

  // 7. Conservative spelling corrections, only when OCR confidence is low
  //    enough that artifacts are expected, but high enough that the text
  //    is mostly trustworthy (avoid "correcting" garbage into nonsense).
  let correctionsApplied = false;
  if (ocrConfidence > 0 && ocrConfidence < 0.85) {
    for (const [pattern, replacement] of SAFE_OCR_CORRECTIONS) {
      if (pattern.test(text)) {
        text = text.replace(pattern, replacement);
        correctionsApplied = true;
      }
    }
  }

  // 8. Trim leading/trailing whitespace overall
  text = text.trim();

  return { cleanText: text, correctionsApplied };
}
