import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeState } from "../fixtures";

vi.mock("../../stageReporter", () => ({
  reportStage: vi.fn().mockResolvedValue(undefined),
}));

import { processEmbeddingStage } from "../../stages/embeddingStage";
import { reportStage } from "../../stageReporter";

describe("processEmbeddingStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports EMBEDDING stage when not yet past it", async () => {
    const state = makeState({ status: "CHUNKING" });

    await processEmbeddingStage(state);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: "EMBEDDING",
        eventType: "embedding_completed",
        progress: 80,
      }),
    );
  });

  it("updates currentStatus to EMBEDDING", async () => {
    const state = makeState({ status: "CHUNKING" });

    const result = await processEmbeddingStage(state);

    expect(result.currentStatus).toBe("EMBEDDING");
  });

  it("skips reportStage when already past EMBEDDING", async () => {
    const state = makeState({ status: "SUMMARIZING" });

    const result = await processEmbeddingStage(state);

    expect(reportStage).not.toHaveBeenCalled();
    expect(result.currentStatus).toBe("SUMMARIZING");
  });

  it("preserves all other state fields unchanged", async () => {
    const state = makeState({
      status: "CHUNKING",
      rawText: "raw",
      cleanText: "clean",
      summary: "sum",
    });

    const result = await processEmbeddingStage(state);

    expect(result.rawText).toBe("raw");
    expect(result.cleanText).toBe("clean");
    expect(result.summary).toBe("sum");
    expect(result.job).toBe(state.job);
    expect(result.doc).toBe(state.doc);
  });

  it("includes documentId and userId from job data in reportStage call", async () => {
    const state = makeState({ status: "CHUNKING" });

    await processEmbeddingStage(state);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-123",
        userId: "user-789",
        workerId: "worker-001",
      }),
    );
  });
});
