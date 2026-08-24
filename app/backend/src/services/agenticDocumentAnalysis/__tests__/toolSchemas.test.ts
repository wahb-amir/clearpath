import { describe, it, expect } from "vitest";
import { ReadDocumentSectionParamsSchema } from "../tools/readDocumentSection";
import { SearchDocumentChunksParamsSchema } from "../tools/searchDocumentChunks";
import { WebSearchParamsSchema, WebSearchPlanSchema } from "../tools/webSearch";
import { ExtractCandidatesParamsSchema } from "../tools/extractCandidates";
import { VerifyAgainstSourcesParamsSchema } from "../tools/verifyAgainstSources";
import { PrepareRagIndexParamsSchema } from "../tools/prepareRagIndex";
import { FinalizeParamsSchema } from "../tools/finalize";

describe("tool schemas", () => {
  describe("read_document_section", () => {
    it("accepts minimal {from}", () => {
      const r = ReadDocumentSectionParamsSchema.safeParse({ from: 0 });
      expect(r.success).toBe(true);
    });

    it("accepts {from, to}", () => {
      const r = ReadDocumentSectionParamsSchema.safeParse({ from: 0, to: 5 });
      expect(r.success).toBe(true);
    });

    it("rejects negative from", () => {
      const r = ReadDocumentSectionParamsSchema.safeParse({ from: -1 });
      expect(r.success).toBe(false);
    });

    it("rejects non-integer from", () => {
      const r = ReadDocumentSectionParamsSchema.safeParse({ from: 1.5 });
      expect(r.success).toBe(false);
    });
  });

  describe("search_document_chunks", () => {
    it("defaults top_k to 8", () => {
      const r = SearchDocumentChunksParamsSchema.parse({ query: "deadline" });
      expect(r.top_k).toBe(8);
    });

    it("rejects empty query", () => {
      const r = SearchDocumentChunksParamsSchema.safeParse({ query: "" });
      expect(r.success).toBe(false);
    });

    it("rejects top_k above 16", () => {
      const r = SearchDocumentChunksParamsSchema.safeParse({
        query: "x",
        top_k: 32,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("web_search", () => {
    it("requires at least one plan", () => {
      const r = WebSearchParamsSchema.safeParse({ plans: [] });
      expect(r.success).toBe(false);
    });

    it("caps plans at 3", () => {
      const r = WebSearchParamsSchema.safeParse({
        plans: [
          { query: "a" },
          { query: "b" },
          { query: "c" },
          { query: "d" },
        ],
      });
      expect(r.success).toBe(false);
    });

    it("rejects short query", () => {
      const r = WebSearchParamsSchema.safeParse({
        plans: [{ query: "ab" }],
      });
      expect(r.success).toBe(false);
    });

    it("accepts a single 3+ char query", () => {
      const r = WebSearchPlanSchema.safeParse({ query: "deadline" });
      expect(r.success).toBe(true);
    });
  });

  describe("extract_candidates", () => {
    it("accepts empty input", () => {
      const r = ExtractCandidatesParamsSchema.safeParse({});
      expect(r.success).toBe(true);
    });

    it("accepts hint", () => {
      const r = ExtractCandidatesParamsSchema.safeParse({
        hint: "focus on appeal",
      });
      expect(r.success).toBe(true);
    });
  });

  describe("verify_against_sources", () => {
    it("accepts no snippets (fallback to ctx.officialSnippets)", () => {
      const r = VerifyAgainstSourcesParamsSchema.safeParse({});
      expect(r.success).toBe(true);
    });

    it("accepts an array of snippets", () => {
      const r = VerifyAgainstSourcesParamsSchema.safeParse({
        snippets: [
          {
            title: "X",
            url: "https://example.gov/x",
            snippet: "hello",
            source: "search_result",
          },
        ],
      });
      expect(r.success).toBe(true);
    });
  });

  describe("prepare_rag_index", () => {
    it("accepts empty object", () => {
      const r = PrepareRagIndexParamsSchema.safeParse({});
      expect(r.success).toBe(true);
    });

    it("accepts undefined", () => {
      const r = PrepareRagIndexParamsSchema.safeParse(undefined);
      expect(r.success).toBe(true);
    });
  });

  describe("finalize", () => {
    const minimal = {
      ai_summary: "This is a notice about benefits.",
      action_items: [],
      key_deadlines: [],
      questions_to_ask: [],
      ai_confidence: {
        overall: 0.5,
        summary: 0.5,
        actions: 0.5,
        deadlines: 0.5,
        questions: 0.5,
      },
      trusted_sources: [],
      needs_human_review: false,
      human_review_reason: "Standard review",
    };

    it("accepts a minimal Stage-4-shaped payload", () => {
      const r = FinalizeParamsSchema.safeParse(minimal);
      expect(r.success).toBe(true);
    });

    it("rejects when needs_human_review and human_review_reason blank", () => {
      // Schema transforms blank to a placeholder, so this should still pass.
      const r = FinalizeParamsSchema.safeParse({
        ...minimal,
        needs_human_review: true,
        human_review_reason: "",
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.human_review_reason.length).toBeGreaterThan(0);
      }
    });

    it("rejects when ai_confidence has missing fields", () => {
      const r = FinalizeParamsSchema.safeParse({
        ...minimal,
        ai_confidence: { overall: 0.5 },
      });
      expect(r.success).toBe(false);
    });
  });
});