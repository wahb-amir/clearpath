import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeState, makeDoc, SAMPLE_EXTRACTED_CONTENT } from "../fixtures";

// Mock all external dependencies
vi.mock("../../stageReporter", () => ({
  reportStage: vi.fn().mockResolvedValue(undefined),
}));

// Use inline values inside vi.mock factories — they are hoisted above const
// declarations so file-level variables are not yet initialised when they run.
vi.mock("../../../services/ingestion/buildStructure", () => ({
  buildDocumentStructure: vi.fn().mockReturnValue([
    { title: "Introduction", level: 1, sectionType: "section", textContent: "Intro text", orderIndex: 0, children: [] },
    { title: "Terms", level: 1, sectionType: "section", textContent: "Terms text", orderIndex: 1, children: [] },
  ]),
}));
vi.mock("../../../services/ingestion/extractFacts", () => ({
  extractFacts: vi.fn().mockReturnValue([
    { factType: "date", value: "2024-03-01", normalizedValue: "2024-03-01", context: "effective date", confidence: 0.9 },
    { factType: "email", value: "legal@example.com", normalizedValue: undefined, context: "contact", confidence: 0.95 },
  ]),
}));
vi.mock("../../../services/ingestion/estimateQuality", () => ({
  estimateQuality: vi.fn().mockReturnValue({ quality: "good", ocrConfidence: 1, textCoverage: 1 }),
}));
vi.mock("../../../services/ingestion/generateSummary", () => ({
  generateSummary: vi.fn().mockReturnValue({
    title: "Service Agreement",
    summary: "A contract between two parties",
  }),
}));
vi.mock("../../../services/ingestion/detectLanguage", () => ({
  detectLanguage: vi.fn().mockReturnValue({ code: "en", name: "English" }),
}));

const mockWithTransaction = vi.fn(async (fn: any) => {
  const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
  await fn(client);
});

vi.mock("../../../db/pool", () => ({
  pgPool: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  withTransaction: (...args: any[]) => mockWithTransaction(...args),
}));

import { processAwaitingVerificationStage } from "../../stages/awaitingVerificationStage";
import { reportStage } from "../../stageReporter";
import { buildDocumentStructure } from "../../../services/ingestion/buildStructure";
import { extractFacts } from "../../../services/ingestion/extractFacts";
import { estimateQuality } from "../../../services/ingestion/estimateQuality";
import { generateSummary } from "../../../services/ingestion/generateSummary";

const MOCK_SECTIONS = [
  { title: "Introduction", level: 1, sectionType: "section", textContent: "Intro text", orderIndex: 0, children: [] },
  { title: "Terms", level: 1, sectionType: "section", textContent: "Terms text", orderIndex: 1, children: [] },
];
const MOCK_FACTS = [
  { factType: "date", value: "2024-03-01", normalizedValue: "2024-03-01", context: "effective date", confidence: 0.9 },
  { factType: "email", value: "legal@example.com", normalizedValue: undefined, context: "contact", confidence: 0.95 },
];
const MOCK_QUALITY = { quality: "good" as const, ocrConfidence: 1, textCoverage: 1 };

describe("processAwaitingVerificationStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildDocumentStructure).mockReturnValue(MOCK_SECTIONS as any);
    vi.mocked(extractFacts).mockReturnValue(MOCK_FACTS as any);
    vi.mocked(estimateQuality).mockReturnValue(MOCK_QUALITY);
    vi.mocked(generateSummary).mockReturnValue({
      title: "Service Agreement",
      summary: "A contract between two parties",
    });
    mockWithTransaction.mockImplementation(async (fn: any) => {
      const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
      await fn(client);
    });
  });

  // -------------------------------------------------------------------------
  // FIRST-RUN PATH (status not yet past AWAITING_VERIFICATION)
  // -------------------------------------------------------------------------
  describe("first-run path (status = CLEANING)", () => {
    it("calls buildDocumentStructure, extractFacts, estimateQuality, generateSummary", async () => {
      const state = makeState({ status: "CLEANING", cleanText: "contract text" });

      await processAwaitingVerificationStage(state);

      expect(buildDocumentStructure).toHaveBeenCalledWith("contract text");
      expect(extractFacts).toHaveBeenCalledWith("contract text");
      expect(estimateQuality).toHaveBeenCalled();
      expect(generateSummary).toHaveBeenCalled();
    });

    it("uses empty string fallback when cleanText is undefined", async () => {
      const state = makeState({ status: "CLEANING" });

      await processAwaitingVerificationStage(state);

      expect(buildDocumentStructure).toHaveBeenCalledWith("");
      expect(extractFacts).toHaveBeenCalledWith("");
    });

    it("persists extracted_content to DB via transaction", async () => {
      const state = makeState({ status: "CLEANING", cleanText: "contract text" });
      let capturedContent: any;

      mockWithTransaction.mockImplementation(async (fn: any) => {
        const client = {
          query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes("extracted_content")) {
              capturedContent = JSON.parse(params[0]);
            }
            return { rows: [] };
          }),
        };
        await fn(client);
      });

      await processAwaitingVerificationStage(state);

      expect(capturedContent).toBeDefined();
      expect(capturedContent.title).toBe("Service Agreement");
      expect(capturedContent.summary).toBe("A contract between two parties");
    });

    it("returns halt: true", async () => {
      const state = makeState({ status: "CLEANING", cleanText: "text" });

      const result = await processAwaitingVerificationStage(state);

      expect(result.halt).toBe(true);
    });

    it("reports AWAITING_VERIFICATION stage with extractedContent payload", async () => {
      const state = makeState({ status: "CLEANING", cleanText: "text" });

      await processAwaitingVerificationStage(state);

      expect(reportStage).toHaveBeenCalledWith(
        expect.objectContaining({
          toStatus: "AWAITING_VERIFICATION",
          eventType: "extraction_awaiting_verification",
          progress: 40,
          payload: expect.objectContaining({
            extractedContent: expect.objectContaining({
              title: "Service Agreement",
            }),
            analysisRequestId: "req-456",
          }),
        }),
      );
    });

    it("extracted content dates include only date/deadline facts", async () => {
      const state = makeState({ status: "CLEANING", cleanText: "text" });
      let capturedContent: any;

      mockWithTransaction.mockImplementation(async (fn: any) => {
        const client = {
          query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes("extracted_content")) {
              capturedContent = JSON.parse(params[0]);
            }
            return { rows: [] };
          }),
        };
        await fn(client);
      });

      await processAwaitingVerificationStage(state);

      // Only the date fact should appear in dates array
      expect(capturedContent.dates).toHaveLength(1);
      expect(capturedContent.dates[0].factType).toBe("date");
      // Email should be in contacts, not dates
      expect(capturedContent.contacts).toHaveLength(1);
      expect(capturedContent.contacts[0].value).toBe("legal@example.com");
    });
  });

  // -------------------------------------------------------------------------
  // RESUME PATH (status already past AWAITING_VERIFICATION)
  // -------------------------------------------------------------------------
  describe("resume path (status = VERIFIED)", () => {
    it("does NOT call buildDocumentStructure, extractFacts, generateSummary", async () => {
      const state = makeState({
        status: "VERIFIED",
        docOverrides: { extracted_content: SAMPLE_EXTRACTED_CONTENT, analysis_status: "VERIFIED" },
      });

      await processAwaitingVerificationStage(state);

      expect(buildDocumentStructure).not.toHaveBeenCalled();
      expect(extractFacts).not.toHaveBeenCalled();
      expect(generateSummary).not.toHaveBeenCalled();
    });

    it("returns halt: false", async () => {
      const state = makeState({
        status: "VERIFIED",
        docOverrides: { extracted_content: SAMPLE_EXTRACTED_CONTENT, analysis_status: "VERIFIED" },
      });

      const result = await processAwaitingVerificationStage(state);

      expect(result.halt).toBe(false);
    });

    it("populates sections on returned state from doc.extracted_content", async () => {
      const state = makeState({
        status: "VERIFIED",
        docOverrides: { extracted_content: SAMPLE_EXTRACTED_CONTENT, analysis_status: "VERIFIED" },
      });

      const result = await processAwaitingVerificationStage(state);

      expect(result.state.sections).toBeDefined();
      expect(result.state.sections).toHaveLength(2);
      expect((result.state.sections as any)[0].title).toBe("Introduction");
    });

    it("populates facts on returned state reconstructed from dates/contacts/amounts/referenceIds", async () => {
      const state = makeState({
        status: "VERIFIED",
        docOverrides: { extracted_content: SAMPLE_EXTRACTED_CONTENT, analysis_status: "VERIFIED" },
      });

      const result = await processAwaitingVerificationStage(state);

      // 1 date + 1 contact + 1 amount + 1 referenceId = 4 facts total
      expect(result.state.facts).toHaveLength(4);
    });

    it("populates title and summary from doc.extracted_content", async () => {
      const state = makeState({
        status: "VERIFIED",
        docOverrides: { extracted_content: SAMPLE_EXTRACTED_CONTENT, analysis_status: "VERIFIED" },
      });

      const result = await processAwaitingVerificationStage(state);

      expect(result.state.title).toBe("Service Agreement");
      expect(result.state.summary).toBe("A contract between two parties");
    });

    it("does not call reportStage on resume path", async () => {
      const state = makeState({
        status: "VERIFIED",
        docOverrides: { extracted_content: SAMPLE_EXTRACTED_CONTENT, analysis_status: "VERIFIED" },
      });

      await processAwaitingVerificationStage(state);

      expect(reportStage).not.toHaveBeenCalled();
    });
  });
});
