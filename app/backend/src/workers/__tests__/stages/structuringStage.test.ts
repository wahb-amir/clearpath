import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeState } from "../fixtures";

vi.mock("../../stageReporter", () => ({
  reportStage: vi.fn().mockResolvedValue(undefined),
  reportProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../db/pool", () => ({
  pgPool: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  withTransaction: vi.fn(async (fn: any) => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    return fn(client);
  }),
}));

// buildDocumentStructure is imported inside structuringStage — mock it
vi.mock("../../../services/ingestion/buildStructure", () => ({
  buildDocumentStructure: vi.fn().mockReturnValue([]),
}));

import { processStructuringStage } from "../../stages/structuringStage";
import { reportStage, reportProgress } from "../../stageReporter";
import { pgPool } from "../../../db/pool";

const mockSections = [
  {
    title: "Intro",
    level: 1,
    sectionType: "section",
    textContent: "text",
    orderIndex: 0,
    children: [
      {
        title: "Sub",
        level: 2,
        sectionType: "section",
        textContent: "sub",
        orderIndex: 0,
        children: [],
      },
    ],
  },
];
const mockFacts = [
  {
    factType: "date" as const,
    value: "2024-01-01",
    normalizedValue: "2024-01-01",
    context: "ctx",
    confidence: 0.9,
  },
  {
    factType: "email" as const,
    value: "a@b.com",
    normalizedValue: undefined,
    context: "ctx",
    confidence: 0.8,
  },
];
const mockQuality = {
  quality: "good" as const,
  ocrConfidence: 1,
  textCoverage: 1,
};

describe("processStructuringStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pgPool.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);
  });

  it("reports STRUCTURING stage when not yet past it", async () => {
    const state = makeState({
      status: "CLEANING",
      sections: mockSections as any,
      facts: mockFacts as any,
      quality: mockQuality,
    });

    await processStructuringStage(state);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: "STRUCTURING",
        eventType: "structure_preserved",
        progress: 45,
      }),
    );
  });

  it("includes correct sectionCount (recursive) and factCount in reportStage payload", async () => {
    // mockSections has 1 parent + 1 child = 2 sections total
    const state = makeState({
      status: "CLEANING",
      sections: mockSections as any,
      facts: mockFacts as any,
      quality: mockQuality,
    });

    await processStructuringStage(state);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { sectionCount: 2, factCount: 2 },
      }),
    );
  });

  it("updates documents.quality in DB", async () => {
    const state = makeState({
      status: "CLEANING",
      sections: mockSections as any,
      facts: mockFacts as any,
      quality: mockQuality,
    });

    await processStructuringStage(state);

    expect(pgPool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE documents SET quality"),
      expect.arrayContaining(["good", "doc-123"]),
    );
  });

  it("emits entities_extracted progress event with factCount", async () => {
    const state = makeState({
      status: "CLEANING",
      sections: mockSections as any,
      facts: mockFacts as any,
      quality: mockQuality,
    });

    await processStructuringStage(state);

    expect(reportProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "entities_extracted",
        payload: { factCount: 2 },
      }),
    );
  });

  it("updates currentStatus to STRUCTURING", async () => {
    const state = makeState({
      status: "CLEANING",
      sections: [] as any,
      facts: [] as any,
      quality: mockQuality,
    });

    const result = await processStructuringStage(state);

    expect(result.currentStatus).toBe("STRUCTURING");
  });

  it("skips all side-effects when already past STRUCTURING", async () => {
    const state = makeState({
      status: "CHUNKING",
      sections: mockSections as any,
      facts: mockFacts as any,
      quality: mockQuality,
    });

    const result = await processStructuringStage(state);

    expect(reportStage).not.toHaveBeenCalled();
    expect(reportProgress).not.toHaveBeenCalled();
    expect(pgPool.query).not.toHaveBeenCalled();
    expect(result.currentStatus).toBe("CHUNKING");
  });

  it("handles empty sections and facts without crashing", async () => {
    const state = makeState({
      status: "CLEANING",
      sections: undefined,
      facts: undefined,
      quality: undefined,
    });

    const result = await processStructuringStage(state);

    expect(result.currentStatus).toBe("STRUCTURING");
    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { sectionCount: 0, factCount: 0 },
      }),
    );
  });

  it("passes sections and facts through unchanged on returned state", async () => {
    const state = makeState({
      status: "CLEANING",
      sections: mockSections as any,
      facts: mockFacts as any,
      quality: mockQuality,
    });

    const result = await processStructuringStage(state);

    expect(result.sections).toBe(mockSections);
    expect(result.facts).toBe(mockFacts);
  });
});
