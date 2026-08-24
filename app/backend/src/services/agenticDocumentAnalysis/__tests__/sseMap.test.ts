import { describe, it, expect } from "vitest";
import {
  toolToSseMap,
  assertToolSseMapIsValid,
  isValidToolName,
} from "../sseMap";
import { PIPELINE_EVENT_TYPES } from "../../../types/pipelineEvents";

describe("sseMap", () => {
  it("every tool name is a valid ToolName", () => {
    for (const name of Object.keys(toolToSseMap)) {
      expect(isValidToolName(name)).toBe(true);
    }
  });

  it("every tool maps to a PipelineEventType literal", () => {
    assertToolSseMapIsValid();
  });

  it("contains the seven expected tools", () => {
    const names = Object.keys(toolToSseMap).sort();
    expect(names).toEqual(
      [
        "extract_candidates",
        "finalize",
        "prepare_rag_index",
        "read_document_section",
        "search_document_chunks",
        "verify_against_sources",
        "web_search",
      ].sort(),
    );
  });

  it("every event type referenced is in PIPELINE_EVENT_TYPES", () => {
    const valid = new Set<string>(PIPELINE_EVENT_TYPES as readonly string[]);
    for (const entry of Object.values(toolToSseMap)) {
      expect(valid.has(entry.start)).toBe(true);
      expect(valid.has(entry.complete)).toBe(true);
    }
  });

  it("web_search maps to the search event triplet", () => {
    expect(toolToSseMap.web_search.start).toBe("ai_search_started");
    expect(toolToSseMap.web_search.complete).toBe("ai_search_completed");
  });

  it("finalize maps to synthesis events", () => {
    expect(toolToSseMap.finalize.start).toBe("ai_synthesis_started");
    expect(toolToSseMap.finalize.complete).toBe("ai_synthesis_completed");
  });
});