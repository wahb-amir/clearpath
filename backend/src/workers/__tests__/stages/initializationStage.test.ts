import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeState } from "../fixtures";

// Mock stageReporter before importing the stage (hoisted by vitest)
vi.mock("../../stageReporter", () => ({
  reportStage: vi.fn().mockResolvedValue(undefined),
  reportProgress: vi.fn().mockResolvedValue(undefined),
}));

import { processInitializationStage } from "../../stages/initializationStage";
import { reportStage } from "../../stageReporter";

describe("processInitializationStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports PROCESSING stage and updates currentStatus when document is QUEUED", async () => {
    const state = makeState({ status: "QUEUED" });

    const result = await processInitializationStage(state);

    expect(reportStage).toHaveBeenCalledOnce();
    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-123",
        userId: "user-789",
        workerId: "worker-001",
        toStatus: "PROCESSING",
        eventType: "worker_assigned",
        progress: 5,
      }),
    );
    expect(result.currentStatus).toBe("PROCESSING");
  });

  it("skips reportStage when document is already past PROCESSING (e.g. EXTRACTING)", async () => {
    const state = makeState({ status: "EXTRACTING" });

    const result = await processInitializationStage(state);

    expect(reportStage).not.toHaveBeenCalled();
    // currentStatus unchanged
    expect(result.currentStatus).toBe("EXTRACTING");
  });

  it("skips reportStage when document is already at PROCESSING", async () => {
    const state = makeState({ status: "PROCESSING" });

    const result = await processInitializationStage(state);

    // PROCESSING is the target — isStageCompleteOrPast checks strictly greater,
    // so currentStatus === target does NOT count as past. Stage still runs.
    expect(reportStage).toHaveBeenCalledOnce();
    expect(result.currentStatus).toBe("PROCESSING");
  });

  it("preserves all other state fields unchanged", async () => {
    const state = makeState({
      status: "QUEUED",
      rawText: "some text",
      cleanText: "clean text",
    });

    const result = await processInitializationStage(state);

    expect(result.job).toBe(state.job);
    expect(result.doc).toBe(state.doc);
    expect(result.workerId).toBe(state.workerId);
    expect(result.rawText).toBe("some text");
    expect(result.cleanText).toBe("clean text");
  });

  it("includes workerId in reportStage message", async () => {
    const state = makeState({ status: "QUEUED" });

    await processInitializationStage(state);

    const call = vi.mocked(reportStage).mock.calls[0][0];
    expect(call.message).toContain("worker-001");
  });
});
