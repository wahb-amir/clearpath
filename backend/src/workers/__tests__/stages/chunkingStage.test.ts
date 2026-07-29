import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeState } from "../fixtures";

vi.mock("../../stageReporter", () => ({
  reportStage: vi.fn().mockResolvedValue(undefined),
  reportProgress: vi.fn().mockResolvedValue(undefined),
}));

// Use inline values — vi.mock factories are hoisted before const declarations
vi.mock("../../../services/ingestion/buildChunks", () => ({
  buildChunks: vi.fn().mockReturnValue([
    { content: "chunk one", chunkLevel: "paragraph", documentId: "doc-123", sectionId: null, orderIndex: 0 },
    { content: "chunk two", chunkLevel: "sentence", documentId: "doc-123", sectionId: null, orderIndex: 1 },
    { content: "chunk three", chunkLevel: "section", documentId: "doc-123", sectionId: null, orderIndex: 2 },
  ]),
}));

vi.mock("../../../services/ingestion/embeddingProvider", () => ({
  embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6], [0.7, 0.8, 0.9]]),
}));

const mockPersistSections = vi.fn().mockResolvedValue(new Map([["section-key", "section-db-id"]]));
const mockPersistChunks = vi.fn().mockResolvedValue(undefined);
const mockPersistFacts = vi.fn().mockResolvedValue(undefined);
const mockClearDerived = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../services/ingestion/persistence", () => ({
  persistSections: (...args: any[]) => mockPersistSections(...args),
  persistChunks: (...args: any[]) => mockPersistChunks(...args),
  persistFacts: (...args: any[]) => mockPersistFacts(...args),
  clearDerivedRecords: (...args: any[]) => mockClearDerived(...args),
}));

const mockTransactionClient = { query: vi.fn().mockResolvedValue({ rows: [] }) };
const mockWithTransaction = vi.fn(async (fn: any) => fn(mockTransactionClient));

vi.mock("../../../db/pool", () => ({
  pgPool: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  withTransaction: (...args: any[]) => mockWithTransaction(...args),
}));

import { processChunkingStage } from "../../stages/chunkingStage";
import { reportStage, reportProgress } from "../../stageReporter";
import { buildChunks } from "../../../services/ingestion/buildChunks";
import { embedBatch } from "../../../services/ingestion/embeddingProvider";

// Inline copies used for assertions (same values as mock returns)
const MOCK_CHUNKS = [
  { content: "chunk one", chunkLevel: "paragraph", documentId: "doc-123", sectionId: null, orderIndex: 0 },
  { content: "chunk two", chunkLevel: "sentence", documentId: "doc-123", sectionId: null, orderIndex: 1 },
  { content: "chunk three", chunkLevel: "section", documentId: "doc-123", sectionId: null, orderIndex: 2 },
];
const MOCK_EMBEDDINGS = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6], [0.7, 0.8, 0.9]];

const mockSections = [
  { title: "Intro", level: 1, sectionType: "section", textContent: "Intro text", orderIndex: 0, children: [] },
];
const mockFacts = [
  { factType: "date" as const, value: "2024-01-01", normalizedValue: "2024-01-01", context: "ctx", confidence: 0.9 },
];

describe("processChunkingStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildChunks).mockReturnValue(MOCK_CHUNKS as any);
    vi.mocked(embedBatch).mockResolvedValue(MOCK_EMBEDDINGS as any);
    mockWithTransaction.mockImplementation(async (fn: any) => fn(mockTransactionClient));
    mockPersistSections.mockResolvedValue(new Map());
    mockPersistChunks.mockResolvedValue(undefined);
    mockPersistFacts.mockResolvedValue(undefined);
    mockClearDerived.mockResolvedValue(undefined);
  });

  it("calls buildChunks with summary and sections from state", async () => {
    const state = makeState({
      status: "STRUCTURING",
      summary: "A contract",
      sections: mockSections as any,
      facts: mockFacts as any,
    });

    await processChunkingStage(state);

    expect(buildChunks).toHaveBeenCalledWith({
      documentSummary: "A contract",
      sections: mockSections,
    });
  });

  it("falls back to empty string summary and empty sections when undefined", async () => {
    const state = makeState({ status: "STRUCTURING" });

    await processChunkingStage(state);

    expect(buildChunks).toHaveBeenCalledWith({
      documentSummary: "",
      sections: [],
    });
  });

  it("calls embedBatch with chunk content strings", async () => {
    const state = makeState({
      status: "STRUCTURING",
      summary: "doc",
      sections: mockSections as any,
      facts: mockFacts as any,
    });

    await processChunkingStage(state);

    expect(embedBatch).toHaveBeenCalledWith(
      ["chunk one", "chunk two", "chunk three"],
      expect.any(Function),
    );
  });

  it("calls clearDerivedRecords before persisting new data", async () => {
    const state = makeState({
      status: "STRUCTURING",
      summary: "doc",
      sections: mockSections as any,
      facts: mockFacts as any,
    });

    await processChunkingStage(state);

    const clearOrder = mockClearDerived.mock.invocationCallOrder[0];
    const sectionsOrder = mockPersistSections.mock.invocationCallOrder[0];
    expect(clearOrder).toBeLessThan(sectionsOrder);
  });

  it("persists sections, facts, and chunks within a single transaction", async () => {
    const state = makeState({
      status: "STRUCTURING",
      summary: "doc",
      sections: mockSections as any,
      facts: mockFacts as any,
    });

    await processChunkingStage(state);

    expect(mockWithTransaction).toHaveBeenCalledOnce();
    expect(mockPersistSections).toHaveBeenCalledWith(mockTransactionClient, "doc-123", mockSections);
    expect(mockPersistFacts).toHaveBeenCalledWith(mockTransactionClient, "doc-123", mockFacts);
    expect(mockPersistChunks).toHaveBeenCalledOnce();
  });

  it("passes embeddings to persistChunks", async () => {
    const state = makeState({
      status: "STRUCTURING",
      summary: "doc",
      sections: mockSections as any,
      facts: mockFacts as any,
    });

    await processChunkingStage(state);

    expect(mockPersistChunks).toHaveBeenCalledWith(
      mockTransactionClient,
      "doc-123",
      MOCK_CHUNKS,
      expect.any(Map),
      MOCK_EMBEDDINGS,
    );
  });

  it("reports CHUNKING stage and progress events", async () => {
    const state = makeState({
      status: "STRUCTURING",
      summary: "doc",
      sections: mockSections as any,
      facts: mockFacts as any,
    });

    await processChunkingStage(state);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({ toStatus: "CHUNKING", eventType: "chunking_completed" }),
    );
    expect(reportProgress).toHaveBeenCalled();
  });

  it("updates currentStatus to CHUNKING", async () => {
    const state = makeState({
      status: "STRUCTURING",
      summary: "doc",
      sections: mockSections as any,
      facts: mockFacts as any,
    });

    const result = await processChunkingStage(state);

    expect(result.currentStatus).toBe("CHUNKING");
  });

  it("skips all work when already past CHUNKING", async () => {
    const state = makeState({ status: "EMBEDDING" });

    const result = await processChunkingStage(state);

    expect(buildChunks).not.toHaveBeenCalled();
    expect(embedBatch).not.toHaveBeenCalled();
    expect(mockWithTransaction).not.toHaveBeenCalled();
    expect(reportStage).not.toHaveBeenCalled();
    expect(result.currentStatus).toBe("EMBEDDING");
  });

  it("chunk level breakdown is correct in progress payload", async () => {
    const state = makeState({
      status: "STRUCTURING",
      summary: "doc",
      sections: mockSections as any,
      facts: mockFacts as any,
    });

    await processChunkingStage(state);

    const progressCalls = vi.mocked(reportProgress).mock.calls;
    const planCall = progressCalls.find((c) =>
      c[0]?.payload && "by_level" in (c[0].payload as any),
    );
    expect(planCall).toBeDefined();
    const byLevel = (planCall![0].payload as any).by_level;
    expect(byLevel.paragraph).toBe(1);
    expect(byLevel.sentence).toBe(1);
    expect(byLevel.section).toBe(1);
  });
});
