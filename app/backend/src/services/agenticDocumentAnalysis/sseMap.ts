/**
 * Maps an agent tool name to the SSE event types emitted around its
 * execution. Centralised so the frontend label mapping (in
 * EVENT_LABELS / PIPELINE_EVENT_TYPES) keeps working unchanged — the
 * agentic pipeline produces the SAME event names as the classic one.
 *
 * `sseMap.test.ts` asserts every entry resolves to a valid
 * PipelineEventType literal so a typo here fails CI.
 */
import { PIPELINE_EVENT_TYPES, type PipelineEventType } from "../../types/pipelineEvents";

export type ToolName =
  | "prepare_rag_index"
  | "read_document_section"
  | "search_document_chunks"
  | "web_search"
  | "extract_candidates"
  | "verify_against_sources"
  | "finalize";

const TOOL_NAME_SET = new Set<string>([
  "prepare_rag_index",
  "read_document_section",
  "search_document_chunks",
  "web_search",
  "extract_candidates",
  "verify_against_sources",
  "finalize",
]);

const PIPELINE_EVENT_TYPE_SET: Set<string> = new Set(
  PIPELINE_EVENT_TYPES as readonly string[],
);

export function isValidToolName(name: string): name is ToolName {
  return TOOL_NAME_SET.has(name);
}

export interface ToolSseMapEntry {
  start: PipelineEventType;
  complete: PipelineEventType;
}

export const toolToSseMap: Record<ToolName, ToolSseMapEntry> = {
  // Defensive no-op tool — surfaces as "preparing" so the UI shows motion.
  prepare_rag_index: {
    start: "ai_understanding_started",
    complete: "ai_understanding_completed",
  },
  // "Reading the document" — uses the extraction progress frame.
  read_document_section: {
    start: "ai_extraction_started",
    complete: "ai_extraction_completed",
  },
  // Vector retrieval — also lives under "extraction" for UI purposes.
  search_document_chunks: {
    start: "ai_extraction_started",
    complete: "ai_extraction_completed",
  },
  // Mirrors the classic web-search frame triplet.
  web_search: {
    start: "ai_search_started",
    complete: "ai_search_completed",
  },
  // Stage 2 equivalent.
  extract_candidates: {
    start: "ai_extraction_started",
    complete: "ai_extraction_completed",
  },
  // Stage 3 equivalent.
  verify_against_sources: {
    start: "ai_verification_started",
    complete: "ai_verification_completed",
  },
  // Stage 4 equivalent.
  finalize: {
    start: "ai_synthesis_started",
    complete: "ai_synthesis_completed",
  },
};

export function assertToolSseMapIsValid(): void {
  for (const [tool, entry] of Object.entries(toolToSseMap)) {
    if (!PIPELINE_EVENT_TYPE_SET.has(entry.start)) {
      throw new Error(
        `Tool "${tool}" maps to unknown start event "${entry.start}"`,
      );
    }
    if (!PIPELINE_EVENT_TYPE_SET.has(entry.complete)) {
      throw new Error(
        `Tool "${tool}" maps to unknown complete event "${entry.complete}"`,
      );
    }
  }
}
