import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { env } from "../../config/env";
import { OcrFailedError } from "../../types/errors";

const execFileAsync = promisify(execFile);

export interface OcrResult {
  text: string;
  /** Mean word confidence (0-1), derived from Tesseract's TSV output. */
  confidence: number;
}

/**
 * OCR via the native `tesseract` CLI (apt-get install tesseract-ocr
 * tesseract-ocr-urd tesseract-ocr-eng). Chosen over tesseract.js/WASM
 * for significantly better speed and accuracy on a Linux server where
 * native binaries are available.
 *
 * Setup (one-time, on the server / in Dockerfile):
 *   apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-urd
 *
 * For PDFs with no embedded text, the caller is responsible for
 * rasterizing pages to images first (see extractText.ts using `pdftoppm`
 * from poppler-utils: apt-get install -y poppler-utils).
 */
export async function runTesseractOcr(
  imageBuffer: Buffer,
  langs: string = env.TESSERACT_LANGS,
): Promise<OcrResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "ocr-"));
  const inputPath = path.join(dir, "input.png");
  const outputBase = path.join(dir, "output");

  try {
    await writeFile(inputPath, imageBuffer);

    // tsv output includes per-word confidence scores
    await execFileAsync(
      "tesseract",
      [inputPath, outputBase, "-l", langs, "tsv"],
      {
        maxBuffer: 1024 * 1024 * 32,
      },
    );

    const tsv = await readFile(`${outputBase}.tsv`, "utf-8");
    return parseTesseractTsv(tsv);
  } catch (err) {
    throw new OcrFailedError("Tesseract OCR execution failed", {
      cause: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Parses Tesseract's TSV output (one row per detected element) into
 * plain text + a mean confidence score across words with conf >= 0
 * (Tesseract uses -1 for non-text rows like page/block boundaries).
 */
function parseTesseractTsv(tsv: string): OcrResult {
  const lines = tsv.trim().split("\n");
  const header = lines[0].split("\t");
  const textIdx = header.indexOf("text");
  const confIdx = header.indexOf("conf");

  const words: string[] = [];
  const confidences: number[] = [];
  let lastLineNum = -1;
  let lastBlockNum = -1;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length <= Math.max(textIdx, confIdx)) continue;

    const conf = Number.parseFloat(cols[confIdx]);
    const text = cols[textIdx];

    if (conf >= 0 && text && text.trim().length > 0) {
      // Insert line breaks between Tesseract line groups for structure
      const lineNum = Number.parseInt(cols[4] ?? "0", 10); // line_num column
      const blockNum = Number.parseInt(cols[2] ?? "0", 10); // block_num column

      if (
        lastLineNum !== -1 &&
        (lineNum !== lastLineNum || blockNum !== lastBlockNum)
      ) {
        words.push("\n");
      }
      lastLineNum = lineNum;
      lastBlockNum = blockNum;

      words.push(text);
      confidences.push(conf / 100);
    }
  }

  const text = words
    .join(" ")
    .replace(/ \n /g, "\n")
    .replace(/ +/g, " ")
    .trim();

  const meanConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  return { text, confidence: meanConfidence };
}

/**
 * Rasterizes a PDF page to a PNG buffer using `pdftoppm` (poppler-utils).
 * Used as the OCR fallback path for PDFs with sparse/no embedded text.
 *
 * Setup: apt-get install -y poppler-utils
 */
export async function rasterizePdfPage(
  pdfBuffer: Buffer,
  pageNumber: number,
  dpi = 200,
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "pdfpage-"));
  const inputPath = path.join(dir, "input.pdf");
  const outputBase = path.join(dir, "page");

  try {
    await writeFile(inputPath, pdfBuffer);
    await execFileAsync("pdftoppm", [
      "-png",
      "-r",
      String(dpi),
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      inputPath,
      outputBase,
    ]);

    // pdftoppm names output like page-1.png or page-01.png depending on page count
    const { readdir } = await import("fs/promises");
    const files = await readdir(dir);
    const pageFile = files.find(
      (f) => f.startsWith("page") && f.endsWith(".png"),
    );
    if (!pageFile) {
      throw new OcrFailedError(
        `pdftoppm produced no output for page ${pageNumber}`,
      );
    }
    return await readFile(path.join(dir, pageFile));
  } catch (err) {
    if (err instanceof OcrFailedError) throw err;
    throw new OcrFailedError("PDF rasterization failed", {
      cause: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
