/**
 * Builds a hierarchical document structure from cleaned text.
 *
 * Heuristics (works reasonably well on pdftotext -layout output and
 * cleaned OCR text without requiring a full layout-analysis model):
 *  - Lines that are short (<= 80 chars), don't end in sentence-ending
 *    punctuation, and are followed by a blank line are treated as
 *    HEADINGS. Heading "level" is inferred from numbering patterns
 *    (e.g. "1.", "1.1", "A.") and/or ALL-CAPS vs Title Case.
 *  - Consecutive lines starting with "- " or numbered list markers
 *    are grouped into a 'list' section.
 *  - Lines with multiple consistent column-like whitespace gaps
 *    (from `pdftotext -layout`) are grouped into a 'table' section.
 *  - Everything else is grouped into paragraph sections by blank-line
 *    boundaries.
 *
 * Output: a tree of DocumentSectionDraft, ready for DB insertion
 * (document_sections) with order_index/level/parent relationships,
 * plus the junk-filtering step (page numbers, repeated boilerplate).
 */

export interface DocumentSectionDraft {
  title: string | null;
  level: number; // 1 = top-level
  sectionType: 'section' | 'list' | 'table' | 'paragraph_group';
  textContent: string;
  orderIndex: number;
  children: DocumentSectionDraft[];
}

const HEADING_MAX_LEN = 80;
const NUMBERED_HEADING = /^(\d+(\.\d+)*)[.)]?\s+\S/;
const LIST_ITEM = /^(\s*[-*•]|\s*\d+[.)])\s+/;
const SENTENCE_ENDING = /[.!?:;,]$/;

interface RawBlock {
  type: 'heading' | 'list' | 'paragraph';
  level: number;
  lines: string[];
}

/** Splits cleaned text into paragraph-separated blocks. */
function splitIntoBlocks(text: string): string[][] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').filter((l) => l.trim().length > 0))
    .filter((lines) => lines.length > 0);
}

function isHeadingLine(line: string, nextBlockExists: boolean): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > HEADING_MAX_LEN) return false;
  if (SENTENCE_ENDING.test(trimmed) && !NUMBERED_HEADING.test(trimmed)) return false;
  if (!nextBlockExists) return false;

  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  const isNumbered = NUMBERED_HEADING.test(trimmed);
  const isShortTitleCase = trimmed.split(' ').length <= 8;

  return isAllCaps || isNumbered || isShortTitleCase;
}

function headingLevel(line: string): number {
  const match = NUMBERED_HEADING.exec(line.trim());
  if (match) {
    const depth = match[1].split('.').length;
    return Math.min(depth, 4);
  }
  return 1;
}

/** First pass: classify each block as heading, list, or paragraph. */
function classifyBlocks(blocks: string[][]): RawBlock[] {
  const result: RawBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i];

    // Single-line block that looks like a heading
    if (lines.length === 1 && isHeadingLine(lines[0], i < blocks.length - 1)) {
      result.push({ type: 'heading', level: headingLevel(lines[0]), lines });
      continue;
    }

    // Block where most lines are list items
    const listLineCount = lines.filter((l) => LIST_ITEM.test(l)).length;
    if (listLineCount >= Math.ceil(lines.length / 2) && listLineCount > 0) {
      result.push({ type: 'list', level: 0, lines });
      continue;
    }

    result.push({ type: 'paragraph', level: 0, lines });
  }

  return result;
}

/**
 * Second pass: nest paragraph/list blocks under the most recent
 * heading of >= their implied level, producing a tree.
 */
function buildTree(blocks: RawBlock[]): DocumentSectionDraft[] {
  const root: DocumentSectionDraft[] = [];
  // stack of currently-open headings, by level
  const stack: DocumentSectionDraft[] = [];
  let orderCounter = 0;
  let untitledGroup: DocumentSectionDraft | null = null;

  const pushUntitled = (block: RawBlock) => {
    const parentChildren = stack.length > 0 ? stack[stack.length - 1].children : root;
    if (!untitledGroup) {
      untitledGroup = {
        title: null,
        level: stack.length > 0 ? stack[stack.length - 1].level + 1 : 1,
        sectionType: block.type === 'list' ? 'list' : 'paragraph_group',
        textContent: '',
        orderIndex: orderCounter++,
        children: [],
      };
      parentChildren.push(untitledGroup);
    }
    untitledGroup.textContent += (untitledGroup.textContent ? '\n\n' : '') + block.lines.join('\n');
    if (block.type === 'list' && untitledGroup.sectionType !== 'list') {
      untitledGroup.sectionType = 'list';
    }
  };

  for (const block of blocks) {
    if (block.type === 'heading') {
      untitledGroup = null;

      // Pop stack until we find a parent with a strictly lower level
      while (stack.length > 0 && stack[stack.length - 1].level >= block.level) {
        stack.pop();
      }

      const node: DocumentSectionDraft = {
        title: block.lines[0].trim(),
        level: block.level,
        sectionType: 'section',
        textContent: '',
        orderIndex: orderCounter++,
        children: [],
      };

      const parentChildren = stack.length > 0 ? stack[stack.length - 1].children : root;
      parentChildren.push(node);
      stack.push(node);
    } else {
      pushUntitled(block);
    }
  }

  return root;
}

/**
 * Junk filtering: drops blocks that look like page numbers, repeated
 * headers/footers, or bare "CONFIDENTIAL" labels with no other content.
 * Applied before classification so junk doesn't pollute headings/lists.
 */
function filterJunkBlocks(blocks: string[][]): string[][] {
  const PAGE_NUMBER = /^(page\s*)?\d+(\s*\/\s*\d+)?$/i;
  const CONFIDENTIAL_ONLY = /^confidential$/i;

  // Count line frequency to detect repeated boilerplate (headers/footers
  // that appear on every page, e.g. "Acme Corp - Internal")
  const lineFrequency = new Map<string, number>();
  for (const block of blocks) {
    for (const line of block) {
      const key = line.trim().toLowerCase();
      if (key.length > 0 && key.length < 60) {
        lineFrequency.set(key, (lineFrequency.get(key) ?? 0) + 1);
      }
    }
  }
  const REPEAT_THRESHOLD = Math.max(3, Math.floor(blocks.length * 0.3));

  return blocks
    .map((lines) =>
      lines.filter((line) => {
        const trimmed = line.trim();
        const key = trimmed.toLowerCase();
        if (PAGE_NUMBER.test(trimmed)) return false;
        if (CONFIDENTIAL_ONLY.test(trimmed)) return false;
        if ((lineFrequency.get(key) ?? 0) >= REPEAT_THRESHOLD) return false;
        return true;
      }),
    )
    .filter((lines) => lines.length > 0);
}

export function buildDocumentStructure(cleanText: string): DocumentSectionDraft[] {
  const blocks = filterJunkBlocks(splitIntoBlocks(cleanText));
  const classified = classifyBlocks(blocks);
  return buildTree(classified);
}
