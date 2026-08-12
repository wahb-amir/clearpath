import { describe, it, expect } from "vitest";
import { makeState } from "../fixtures";
import { processChunkingStage } from "../../stages/chunkingStage";

describe("processChunkingStage", () => {
  it("bypasses chunking logic and returns state unmodified", async () => {
    const state = makeState({
      status: "STRUCTURING",
      summary: "A contract",
    });

    const result = await processChunkingStage(state);

    // Current status is not modified, state is returned as-is
    expect(result.currentStatus).toBe("STRUCTURING");
    expect(result.summary).toBe("A contract");
  });
});

