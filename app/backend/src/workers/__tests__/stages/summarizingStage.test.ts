import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeState } from "../fixtures";

vi.mock("../../stageReporter", () => ({
  reportStage: vi.fn().mockResolvedValue(undefined),
}));

import { processSummarizingStage } from "../../stages/summarizingStage";
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

  it("handles undefined title and summary without crashing", async () => {
    const state = makeState({ status: "EMBEDDING" });

    const result = await processSummarizingStage(state);

    expect(result.currentStatus).toBe("SUMMARIZING");
    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { title: undefined, summary: undefined },
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
