import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeState } from "../fixtures";

// Mock all external dependencies before importing the stage
vi.mock("../../stageReporter", () => ({
  reportStage: vi.fn().mockResolvedValue(undefined),
  reportProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/ingestion/cleanText", () => ({
  cleanExtractedText: vi.fn().mockReturnValue({
    cleanText: "cleaned text content",
    correctionsApplied: true,
  }),
}));

vi.mock("../../../services/ingestion/detectLanguage", () => ({
  detectLanguage: vi.fn().mockReturnValue({ code: "en", name: "English" }),
}));

vi.mock("../../../db/pool", () => ({
  pgPool: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  withTransaction: vi.fn(async (fn: any) => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    return fn(client);
  }),
}));

import { processCleaningStage } from "../../stages/cleaningStage";
import { reportStage, reportProgress } from "../../stageReporter";
import { cleanExtractedText } from "../../../services/ingestion/cleanText";
import { detectLanguage } from "../../../services/ingestion/detectLanguage";
import { pgPool } from "../../../db/pool";

describe("processCleaningStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cleanExtractedText).mockReturnValue({
      cleanText: "cleaned text content",
      correctionsApplied: true,
    });
    vi.mocked(detectLanguage).mockReturnValue({ code: "en", name: "English" });
    vi.mocked(pgPool.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);
  });

  it("calls cleanExtractedText with rawText from upstream state", async () => {
    const state = makeState({ status: "EXTRACTING", rawText: "raw  text  with  noise" });

    await processCleaningStage(state);

    expect(cleanExtractedText).toHaveBeenCalledWith("raw  text  with  noise", expect.any(Number));
  });

  it("passes ocrConfidence to cleanExtractedText", async () => {
    const state = makeState({ status: "EXTRACTING", rawText: "text", ocrConfidence: 0.7 });

    await processCleaningStage(state);

    expect(cleanExtractedText).toHaveBeenCalledWith("text", 0.7);
  });

  it("falls back to empty string when rawText is undefined", async () => {
    const state = makeState({ status: "EXTRACTING" });

    await processCleaningStage(state);

    expect(cleanExtractedText).toHaveBeenCalledWith("", expect.any(Number));
  });

  it("falls back to ocrConfidence=1 when undefined", async () => {
    const state = makeState({ status: "EXTRACTING", rawText: "text" });

    await processCleaningStage(state);

    expect(cleanExtractedText).toHaveBeenCalledWith("text", 1);
  });

  it("populates cleanText on the returned state from the service result", async () => {
    const state = makeState({ status: "EXTRACTING", rawText: "noisy input" });

    const result = await processCleaningStage(state);

    expect(result.cleanText).toBe("cleaned text content");
  });

  it("reports CLEANING stage when not yet past it", async () => {
    const state = makeState({ status: "EXTRACTING" });

    await processCleaningStage(state);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: "CLEANING",
        eventType: "text_cleaned",
        progress: 35,
      }),
    );
  });

  it("reports correctionsApplied in the payload", async () => {
    const state = makeState({ status: "EXTRACTING" });

    await processCleaningStage(state);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ correctionsApplied: true }),
      }),
    );
  });

  it("detects and saves language to DB when not yet past CLEANING", async () => {
    const state = makeState({ status: "EXTRACTING" });

    await processCleaningStage(state);

    expect(detectLanguage).toHaveBeenCalledWith("cleaned text content");
    expect(pgPool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE documents SET language"),
      expect.arrayContaining(["en", "doc-123"]),
    );
  });

  it("emits language_detected progress event", async () => {
    const state = makeState({ status: "EXTRACTING" });

    await processCleaningStage(state);

    expect(reportProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "language_detected",
        payload: expect.objectContaining({ language: "en", languageName: "English" }),
      }),
    );
  });

  it("updates currentStatus to CLEANING", async () => {
    const state = makeState({ status: "EXTRACTING" });

    const result = await processCleaningStage(state);

    expect(result.currentStatus).toBe("CLEANING");
  });

  it("skips reportStage when already past CLEANING (e.g. STRUCTURING)", async () => {
    const state = makeState({ status: "STRUCTURING" });

    const result = await processCleaningStage(state);

    expect(reportStage).not.toHaveBeenCalled();
    expect(pgPool.query).not.toHaveBeenCalled();
    // Still returns cleanText from service (always runs)
    expect(result.cleanText).toBe("cleaned text content");
  });

  it("does not mutate the input state object", async () => {
    const state = makeState({ status: "EXTRACTING", rawText: "original" });
    const originalStatus = state.currentStatus;

    await processCleaningStage(state);

    expect(state.currentStatus).toBe(originalStatus);
    expect(state.cleanText).toBeUndefined();
  });
});
