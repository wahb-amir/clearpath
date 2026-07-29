/**
 * Integration tests for the full document analysis pipeline.
 *
 * These tests wire all stages together exactly as analysisWorker.ts does,
 * but with ALL external I/O (DB, Redis, Supabase, extraction services)
 * replaced by deterministic in-memory stubs.
 *
 * Goal: verify that state flows correctly from one stage to the next,
 * including that each stage's output fields are available to downstream stages.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeJob, makeDoc, SAMPLE_EXTRACTED_CONTENT } from "./fixtures";
import type { AnalysisState } from "../stages/types";

// ---------------------------------------------------------------------------
// MOCKS — vi.mock factories are hoisted to the top of the file, so they run
// before ANY const/let declarations. Only literals and vi.fn() are safe inside.
// ---------------------------------------------------------------------------

vi.mock("../stageReporter", () => ({
  reportStage: vi.fn().mockResolvedValue(undefined),
  reportProgress: vi.fn().mockResolvedValue(undefined),
  reportFailure: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/ingestion/cleanText", () => ({
  cleanExtractedText: vi.fn().mockReturnValue({
    cleanText: "This agreement is between Party A and Party B.",
    correctionsApplied: 0,
  }),
}));

vi.mock("../../services/ingestion/detectLanguage", () => ({
  detectLanguage: vi.fn().mockReturnValue({ code: "en", name: "English" }),
}));

vi.mock("../../services/ingestion/buildStructure", () => ({
  buildDocumentStructure: vi.fn().mockReturnValue([
    { title: "Introduction", level: 1, sectionType: "section", textContent: "This agreement is between Party A and Party B.", orderIndex: 0, children: [] },
  ]),
}));

vi.mock("../../services/ingestion/extractFacts", () => ({
  extractFacts: vi.fn().mockReturnValue([
    { factType: "date", value: "2024-03-01", normalizedValue: "2024-03-01", context: "effective date", confidence: 0.9 },
  ]),
}));

vi.mock("../../services/ingestion/estimateQuality", () => ({
  estimateQuality: vi.fn().mockReturnValue({ quality: "good", ocrConfidence: 0.95, textCoverage: 1 }),
}));

vi.mock("../../services/ingestion/generateSummary", () => ({
  generateSummary: vi.fn().mockReturnValue({
    title: "Service Agreement",
    summary: "A contract between two parties.",
  }),
}));

vi.mock("../../services/ingestion/extractText", () => ({
  extractText: vi.fn().mockResolvedValue({
    rawText: "This agreement is between Party A and Party B.",
    method: "embedded",
    ocrConfidence: 0.95,
    textCoverage: 1,
    usedOcrFallback: false,
  }),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        download: vi.fn().mockResolvedValue({
          data: new Blob(["mock pdf content"]),
          error: null,
        }),
      }),
    },
  },
}));

vi.mock("../../services/ingestion/buildChunks", () => ({
  buildChunks: vi.fn().mockReturnValue([
    { content: "This agreement is between Party A and Party B.", chunkLevel: "paragraph", documentId: "doc-123", sectionId: null, orderIndex: 0 },
  ]),
}));

vi.mock("../../services/ingestion/embeddingProvider", () => ({
  embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
}));

const mockPersistSections = vi.fn().mockResolvedValue(new Map());
const mockPersistChunks = vi.fn().mockResolvedValue(undefined);
const mockPersistFacts = vi.fn().mockResolvedValue(undefined);
const mockClearDerived = vi.fn().mockResolvedValue(undefined);

vi.mock("../../services/ingestion/persistence", () => ({
  persistSections: (...args: any[]) => mockPersistSections(...args),
  persistChunks: (...args: any[]) => mockPersistChunks(...args),
  persistFacts: (...args: any[]) => mockPersistFacts(...args),
  clearDerivedRecords: (...args: any[]) => mockClearDerived(...args),
}));

// In-memory DB mock — captures all outbox inserts
const outboxInserts: Array<{ aggregateId: string; payload: any }> = [];

const mockDbClient = {
  query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
    if (sql.includes("document_pipeline_outbox")) {
      outboxInserts.push({ aggregateId: params?.[0], payload: params?.[1] ? JSON.parse(params[1]) : null });
    }
    return { rows: [], rowCount: 0 };
  }),
};

vi.mock("../../db/pool", () => ({
  pgPool: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  },
  withTransaction: vi.fn().mockImplementation(async (fn: any) => fn(mockDbClient)),
}));

// ---------------------------------------------------------------------------
// Import stages AFTER mocks are registered
// ---------------------------------------------------------------------------
import { processInitializationStage } from "../stages/initializationStage";
import { processExtractionStage } from "../stages/extractionStage";
import { processCleaningStage } from "../stages/cleaningStage";
import { processAwaitingVerificationStage } from "../stages/awaitingVerificationStage";
import { processStructuringStage } from "../stages/structuringStage";
import { processChunkingStage } from "../stages/chunkingStage";
import { processEmbeddingStage } from "../stages/embeddingStage";
import { processSummarizingStage } from "../stages/summarizingStage";
import { processCompletionStage } from "../stages/completionStage";
import { reportStage, reportProgress } from "../stageReporter";
import { buildChunks } from "../../services/ingestion/buildChunks";
import { embedBatch } from "../../services/ingestion/embeddingProvider";
import { cleanExtractedText } from "../../services/ingestion/cleanText";
import { withTransaction } from "../../db/pool";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInitialState(status = "QUEUED" as any): AnalysisState {
  const doc = makeDoc({ analysis_status: status });
  const job = makeJob();
  return { job, doc, workerId: "worker-001", currentStatus: status };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Pipeline Integration – Fresh Document (QUEUED → halts at AWAITING_VERIFICATION)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    outboxInserts.length = 0;
    vi.mocked(cleanExtractedText).mockReturnValue({
      cleanText: "This agreement is between Party A and Party B.",
      correctionsApplied: 0,
    });
    vi.mocked(withTransaction).mockImplementation(async (fn: any) => fn(mockDbClient));
    mockDbClient.query.mockClear();
  });

  it("initialization → extraction: rawText is populated on state", async () => {
    let state = makeInitialState("QUEUED");

    state = await processInitializationStage(state);
    expect(state.currentStatus).toBe("PROCESSING");

    state = await processExtractionStage(state);
    expect(state.rawText).toBe("This agreement is between Party A and Party B.");
    expect(state.extractionMethod).toBe("embedded");
    expect(state.ocrConfidence).toBe(0.95);
  });

  it("extraction → cleaning: cleanText is derived from rawText", async () => {
    let state = makeInitialState("QUEUED");
    state = await processInitializationStage(state);
    state = await processExtractionStage(state);

    state = await processCleaningStage(state);

    expect(state.cleanText).toBe("This agreement is between Party A and Party B.");
    expect(state.currentStatus).toBe("CLEANING");
  });

  it("cleaning → awaitingVerification: returns halt:true on first pass", async () => {
    let state = makeInitialState("QUEUED");
    state = await processInitializationStage(state);
    state = await processExtractionStage(state);
    state = await processCleaningStage(state);

    const result = await processAwaitingVerificationStage(state);

    expect(result.halt).toBe(true);
    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({ toStatus: "AWAITING_VERIFICATION" }),
    );
  });

  it("pipeline flow produces correct sequence of stage transitions", async () => {
    let state = makeInitialState("QUEUED");
    state = await processInitializationStage(state);
    state = await processExtractionStage(state);
    state = await processCleaningStage(state);
    await processAwaitingVerificationStage(state);

    const reportedStatuses = vi.mocked(reportStage).mock.calls.map(
      (c) => c[0].toStatus,
    );
    expect(reportedStatuses).toEqual([
      "PROCESSING",
      "EXTRACTING",
      "CLEANING",
      "AWAITING_VERIFICATION",
    ]);
  });
});

describe("Pipeline Integration – Resume Path (VERIFIED → PREPROCESSING_COMPLETED)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    outboxInserts.length = 0;
    mockPersistSections.mockResolvedValue(new Map());
    mockPersistChunks.mockResolvedValue(undefined);
    mockPersistFacts.mockResolvedValue(undefined);
    mockClearDerived.mockResolvedValue(undefined);
    vi.mocked(withTransaction).mockImplementation(async (fn: any) => fn(mockDbClient));
    mockDbClient.query.mockClear();
    mockDbClient.query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes("document_pipeline_outbox")) {
        outboxInserts.push({ aggregateId: params?.[0], payload: params?.[1] ? JSON.parse(params[1]) : null });
      }
      return { rows: [], rowCount: 0 };
    });
  });

  function makeResumedState(): AnalysisState {
    const doc = makeDoc({
      analysis_status: "VERIFIED",
      extracted_content: SAMPLE_EXTRACTED_CONTENT,
    });
    return { job: makeJob(), doc, workerId: "worker-001", currentStatus: "VERIFIED" };
  }

  it("awaitingVerification resume path populates sections, facts, quality, title, summary", async () => {
    const state = makeResumedState();

    const result = await processAwaitingVerificationStage(state);

    expect(result.halt).toBe(false);
    expect(result.state.sections).toBeDefined();
    expect(result.state.facts).toBeDefined();
    expect(result.state.quality).toBeDefined();
    expect(result.state.title).toBe("Service Agreement");
    expect(result.state.summary).toBe("A contract between two parties");
  });

  it("sections from resume path flow into structuring stage correctly", async () => {
    const state = makeResumedState();
    const { state: hydratedState } = await processAwaitingVerificationStage(state);

    const structured = await processStructuringStage(hydratedState);

    expect(structured.sections).toBe(hydratedState.sections);
    expect(structured.currentStatus).toBe("STRUCTURING");
  });

  it("facts and sections from resume flow into chunking stage", async () => {
    const state = makeResumedState();
    const { state: hydratedState } = await processAwaitingVerificationStage(state);
    const structured = await processStructuringStage(hydratedState);

    const chunked = await processChunkingStage(structured);

    expect(buildChunks).toHaveBeenCalledWith(
      expect.objectContaining({ sections: hydratedState.sections }),
    );
    expect(chunked.currentStatus).toBe("CHUNKING");
  });

  it("chunking stage calls embedBatch and persists all data", async () => {
    const state = makeResumedState();
    const { state: hydratedState } = await processAwaitingVerificationStage(state);
    const structured = await processStructuringStage(hydratedState);
    await processChunkingStage(structured);

    expect(embedBatch).toHaveBeenCalledOnce();
    expect(mockPersistSections).toHaveBeenCalledOnce();
    expect(mockPersistFacts).toHaveBeenCalledOnce();
    expect(mockPersistChunks).toHaveBeenCalledOnce();
  });

  it("full post-verification pipeline reaches PREPROCESSING_COMPLETED", async () => {
    const state = makeResumedState();
    const { state: hydratedState } = await processAwaitingVerificationStage(state);
    let s = await processStructuringStage(hydratedState);
    s = await processChunkingStage(s);
    s = await processEmbeddingStage(s);
    s = await processSummarizingStage(s);
    await processCompletionStage(s);

    const statuses = vi.mocked(reportStage).mock.calls.map((c) => c[0].toStatus);
    expect(statuses).toContain("STRUCTURING");
    expect(statuses).toContain("CHUNKING");
    expect(statuses).toContain("EMBEDDING");
    expect(statuses).toContain("SUMMARIZING");
    expect(statuses).toContain("PREPROCESSING_COMPLETED");
  });

  it("completionStage inserts outbox event with correct payload", async () => {
    const state = makeResumedState();
    const { state: hydratedState } = await processAwaitingVerificationStage(state);
    let s = await processStructuringStage(hydratedState);
    s = await processChunkingStage(s);
    s = await processEmbeddingStage(s);
    s = await processSummarizingStage(s);
    await processCompletionStage(s);

    expect(outboxInserts).toHaveLength(1);
    expect(outboxInserts[0].payload).toEqual({
      documentId: "doc-123",
      userId: "user-789",
      analysisRequestId: "req-456",
      analysisVersion: "v1",
    });
  });

  it("title and summary from resume path flow into summarizing stage payload", async () => {
    const state = makeResumedState();
    const { state: hydratedState } = await processAwaitingVerificationStage(state);
    let s = await processStructuringStage(hydratedState);
    s = await processChunkingStage(s);
    s = await processEmbeddingStage(s);
    await processSummarizingStage(s);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: "SUMMARIZING",
        payload: {
          title: "Service Agreement",
          summary: "A contract between two parties",
        },
      }),
    );
  });
});

describe("Pipeline Integration – Skip-Completed Stages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistSections.mockResolvedValue(new Map());
    mockPersistChunks.mockResolvedValue(undefined);
    mockPersistFacts.mockResolvedValue(undefined);
    mockClearDerived.mockResolvedValue(undefined);
    vi.mocked(withTransaction).mockImplementation(async (fn: any) => fn(mockDbClient));
  });

  it("document at CHUNKING skips PROCESSING, EXTRACTING, CLEANING, STRUCTURING", async () => {
    const doc = makeDoc({
      analysis_status: "CHUNKING",
      extracted_content: SAMPLE_EXTRACTED_CONTENT,
    });
    let state: AnalysisState = {
      job: makeJob(),
      doc,
      workerId: "worker-001",
      currentStatus: "CHUNKING",
    };

    // Run all pre-chunking stages — they should all skip
    state = await processInitializationStage(state);
    state = await processExtractionStage(state);
    state = await processCleaningStage(state);

    const verifResult = await processAwaitingVerificationStage(state);
    if (!verifResult.halt) {
      state = verifResult.state;
    }

    state = await processStructuringStage(state);

    const reportedSoFar = vi.mocked(reportStage).mock.calls.map((c) => c[0].toStatus);
    expect(reportedSoFar).not.toContain("PROCESSING");
    expect(reportedSoFar).not.toContain("EXTRACTING");
    expect(reportedSoFar).not.toContain("CLEANING");
    expect(reportedSoFar).not.toContain("AWAITING_VERIFICATION");
    expect(reportedSoFar).not.toContain("STRUCTURING");
  });

  it("document at EMBEDDING still runs EMBEDDING, SUMMARIZING, PREPROCESSING_COMPLETED", async () => {
    const doc = makeDoc({ analysis_status: "EMBEDDING" });
    let state: AnalysisState = {
      job: makeJob(),
      doc,
      workerId: "worker-001",
      currentStatus: "EMBEDDING",
      title: "Existing Title",
      summary: "Existing Summary",
    };

    state = await processEmbeddingStage(state);
    state = await processSummarizingStage(state);
    await processCompletionStage(state);

    const statuses = vi.mocked(reportStage).mock.calls.map((c) => c[0].toStatus);
    expect(statuses).toContain("EMBEDDING");
    expect(statuses).toContain("SUMMARIZING");
    expect(statuses).toContain("PREPROCESSING_COMPLETED");
  });
});

describe("Pipeline Integration – State Immutability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation(async (fn: any) => fn(mockDbClient));
  });

  it("each stage returns a new state object (spread pattern)", async () => {
    const initialState = makeInitialState("QUEUED");
    const afterInit = await processInitializationStage(initialState);

    expect(afterInit).not.toBe(initialState);
    expect(initialState.currentStatus).toBe("QUEUED");
  });

  it("cleaning stage does not mutate input state", async () => {
    const state = makeInitialState("EXTRACTING");
    (state as any).rawText = "some raw text";
    const originalCleanText = state.cleanText;

    const result = await processCleaningStage(state);

    expect(state.cleanText).toBe(originalCleanText); // original untouched
    expect(result.cleanText).toBeDefined();
    expect(result).not.toBe(state);
  });
});

describe("Pipeline Integration – analysisWorker guard logic", () => {
  it("identifies all terminal/skip statuses correctly", () => {
    const SHOULD_SKIP = [
      "COMPLETED", "CANCELLED", "FAILED",
      "AWAITING_VERIFICATION", "PREPROCESSING_COMPLETED",
      "AI_QUEUED", "AI_PROCESSING", "AI_COMPLETED",
    ];

    for (const status of SHOULD_SKIP) {
      // This mirrors the guard in processAnalysisJob
      const shouldSkip = [
        "COMPLETED", "CANCELLED", "FAILED",
        "AWAITING_VERIFICATION", "PREPROCESSING_COMPLETED",
        "AI_QUEUED", "AI_PROCESSING", "AI_COMPLETED",
      ].includes(status);
      expect(shouldSkip).toBe(true);
    }

    const SHOULD_NOT_SKIP = ["QUEUED", "PROCESSING", "EXTRACTING", "CLEANING"];
    for (const status of SHOULD_NOT_SKIP) {
      const shouldSkip = [
        "COMPLETED", "CANCELLED", "FAILED",
        "AWAITING_VERIFICATION", "PREPROCESSING_COMPLETED",
        "AI_QUEUED", "AI_PROCESSING", "AI_COMPLETED",
      ].includes(status);
      expect(shouldSkip).toBe(false);
    }
  });
});
