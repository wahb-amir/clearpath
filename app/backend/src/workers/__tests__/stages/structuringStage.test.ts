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

// buildDocumentStructure and extractFacts are imported inside structuringStage — mock them
vi.mock("../../../services/ingestion/buildStructure", () => ({
  buildDocumentStructure: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../services/ingestion/extractFacts", () => ({
  extractFacts: vi.fn().mockReturnValue([]),
}));

import { processStructuringStage } from "../../stages/structuringStage";
import { reportStage, reportProgress } from "../../stageReporter";
import { pgPool } from "../../../db/pool";
import { buildDocumentStructure } from "../../../services/ingestion/buildStructure";
import { extractFacts } from "../../../services/ingestion/extractFacts";

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
    vi.mocked(buildDocumentStructure).mockReturnValue([] as any);
    vi.mocked(extractFacts).mockReturnValue([] as any);
  });

  it("builds sections/facts from cleanText via buildDocumentStructure and extractFacts", async () => {
    vi.mocked(buildDocumentStructure).mockReturnValue(mockSections as any);
    vi.mocked(extractFacts).mockReturnValue(mockFacts as any);

    const state = makeState({
      status: "CLEANING",
      cleanText: "Intro\n\ntext",
      quality: mockQuality,
    });

    await processStructuringStage(state);

    expect(buildDocumentStructure).toHaveBeenCalledWith("Intro\n\ntext");
    expect(extractFacts).toHaveBeenCalledWith("Intro\n\ntext");
  });

  it("reports STRUCTURING stage when not yet past it", async () => {
    const state = makeState({
      status: "CLEANING",
      cleanText: "some text",
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
    vi.mocked(buildDocumentStructure).mockReturnValue(mockSections as any);
    vi.mocked(extractFacts).mockReturnValue(mockFacts as any);

    const state = makeState({
      status: "CLEANING",
      cleanText: "some text",
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
      cleanText: "some text",
      quality: mockQuality,
    });

    await processStructuringStage(state);

    expect(pgPool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE documents SET quality"),
      expect.arrayContaining(["good", "doc-123"]),
    );
  });

  it("emits entities_extracted progress event with factCount", async () => {
    vi.mocked(extractFacts).mockReturnValue(mockFacts as any);

    const state = makeState({
      status: "CLEANING",
      cleanText: "some text",
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
      cleanText: "",
      quality: mockQuality,
    });

    const result = await processStructuringStage(state);

    expect(result.currentStatus).toBe("STRUCTURING");
  });

  it("skips reporting side-effects when already past STRUCTURING, but still computes sections/facts", async () => {
    vi.mocked(buildDocumentStructure).mockReturnValue(mockSections as any);
    vi.mocked(extractFacts).mockReturnValue(mockFacts as any);

    const state = makeState({
      status: "CHUNKING",
      cleanText: "some text",
      quality: mockQuality,
    });

    const result = await processStructuringStage(state);

    expect(reportStage).not.toHaveBeenCalled();
    expect(reportProgress).not.toHaveBeenCalled();
    expect(pgPool.query).not.toHaveBeenCalled();
    expect(result.currentStatus).toBe("CHUNKING");
    // even when the stage's own status transition is skipped, downstream
    // stages (chunking) still need sections/facts on the returned state
    expect(result.sections).toEqual(mockSections);
    expect(result.facts).toEqual(mockFacts);
  });

  it("handles empty/missing cleanText without crashing", async () => {
    const state = makeState({
      status: "CLEANING",
      cleanText: undefined,
      quality: undefined,
    });

    const result = await processStructuringStage(state);

    expect(buildDocumentStructure).toHaveBeenCalledWith("");
    expect(extractFacts).toHaveBeenCalledWith("");
    expect(result.currentStatus).toBe("STRUCTURING");
    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { sectionCount: 0, factCount: 0 },
      }),
    );
  });

  it("carries freshly computed sections and facts on the returned state", async () => {
    vi.mocked(buildDocumentStructure).mockReturnValue(mockSections as any);
    vi.mocked(extractFacts).mockReturnValue(mockFacts as any);

    const state = makeState({
      status: "CLEANING",
      cleanText: "some text",
      quality: mockQuality,
    });

    const result = await processStructuringStage(state);

    expect(result.sections).toEqual(mockSections);
    expect(result.facts).toEqual(mockFacts);
  });
});
