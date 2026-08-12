import { describe, it, expect } from "vitest";
import { makeState } from "../fixtures";
import { processEmbeddingStage } from "../../stages/embeddingStage";

describe("processEmbeddingStage", () => {
  it("bypasses embedding logic and returns state unmodified", async () => {
    const state = makeState({
      status: "STRUCTURING",
      summary: "A contract",
    });

    const result = await processEmbeddingStage(state);

    // Current status is not modified, state is returned as-is
    expect(result.currentStatus).toBe("STRUCTURING");
    expect(result.summary).toBe("A contract");
  });
});

