import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeState } from "../fixtures";

vi.mock("../../stageReporter", () => ({
  reportStage: vi.fn().mockResolvedValue(undefined),
}));

import {
  processSummarizingStage,
  generateSummary,
} from "../../stages/summarizingStage";
import { reportStage } from "../../stageReporter";

describe("processSummarizingStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports SUMMARIZING stage when not yet past it", async () => {
    const state = makeState({
      status: "EMBEDDING",
      title: "My Doc",
      summary: "A summary",
    });

    await processSummarizingStage(state);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: "SUMMARIZING",
        eventType: "summary_created",
        progress: 90,
      }),
    );
  });

  it("includes title and summary from state in the payload", async () => {
    const state = makeState({
      status: "EMBEDDING",
      title: "My Doc",
      summary: "A summary",
    });

    await processSummarizingStage(state);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { title: "My Doc", summary: "A summary" },
      }),
    );
  });

  it("creates a document title and summary from the cleaned text", () => {
    const result = generateSummary({
      cleanText: "Introduction\nThis is the first paragraph.\nSecond paragraph.\n\nTerms\nThe agreement starts today.",
      sections: [
        { title: "Introduction", textContent: "This is the first paragraph. Second paragraph.", level: 1, sectionType: "section", orderIndex: 0, children: [] },
        { title: "Terms", textContent: "The agreement starts today.", level: 1, sectionType: "section", orderIndex: 1, children: [] },
      ],
    });

    expect(result.title).toBe("Introduction");
    expect(result.summary).toContain("This is the first paragraph");
  });

  it("updates currentStatus to SUMMARIZING", async () => {
    const state = makeState({
      status: "EMBEDDING",
      title: "My Doc",
      summary: "A summary",
    });

    const result = await processSummarizingStage(state);

    expect(result.currentStatus).toBe("SUMMARIZING");
  });

  it("skips reportStage when already past SUMMARIZING", async () => {
    const state = makeState({ status: "PREPROCESSING_COMPLETED" });

    const result = await processSummarizingStage(state);

    expect(reportStage).not.toHaveBeenCalled();
    expect(result.currentStatus).toBe("PREPROCESSING_COMPLETED");
  });

  it("generates a fallback title and summary when none exist", async () => {
    const state = makeState({ status: "EMBEDDING" });

    const result = await processSummarizingStage(state);

    expect(result.currentStatus).toBe("SUMMARIZING");
    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { title: "Untitled document", summary: "" },
      }),
    );
  });

  it("preserves all other state fields", async () => {
    const state = makeState({
      status: "EMBEDDING",
      markdownContent: "raw",
    });

    const result = await processSummarizingStage(state);

    expect(result.markdownContent).toBe("raw");
    expect(result.job).toBe(state.job);
  });
});
