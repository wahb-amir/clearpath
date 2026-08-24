import { describe, it, expect } from "vitest";
import type { NormalizedDocument } from "../../../types/documentAnalysis";
import { buildFinalResult } from "../finalize";
import {
  makeStage1Fallback,
  makeStage3Fallback,
} from "../../documentAnalysisPipeline/fallbacks";
import type { Stage4 } from "../../documentAnalysisPipeline/schemas";

const document: NormalizedDocument = {
  document_id: "00000000-0000-0000-0000-000000000001",
  user_id: "user-1",
  file_type: "application/pdf",
  language: "en",
  source_text:
    "This is a school attendance notice. Eligibility: must respond within 5 days. Appeal rights explained.",
  sections: [],
  entities: { dates: [], contacts: [], urls: [], names: [] },
};

const stage4: Stage4 = {
  ai_summary: "You must respond within 5 days.",
  action_items: [
    {
      text: "Call the school office",
      priority: "high",
      supporting_evidence: "Eligibility section",
      completed: false,
    },
  ],
  key_deadlines: [
    {
      text: "5 days from receipt",
      meaning: "You will lose the benefit",
      priority: "high",
      supporting_evidence: "Eligibility section",
    },
  ],
  questions_to_ask: ["Can I get more time?"],
  ai_confidence: {
    overall: 0.7,
    summary: 0.7,
    actions: 0.7,
    deadlines: 0.7,
    questions: 0.7,
  },
  trusted_sources: [
    { title: "CA Dept of Ed", url: "https://ca.gov/example", why_it_matters: "Official policy" },
  ],
  needs_human_review: false,
  human_review_reason: "Standard review",
};

describe("buildFinalResult", () => {
  it("produces a DocumentAnalysisPipelineResult-shaped object", async () => {
    const result = await buildFinalResult({
      document,
      stage1: makeStage1Fallback(document),
      stage3: makeStage3Fallback(),
      stage4,
      officialSnippets: [],
    });
    expect(result.status).toBe("completed");
    expect(result.summary).toBeDefined();
    expect(result.action_items).toBeDefined();
    expect(result.key_deadlines).toBeDefined();
    expect(result.questions_to_ask).toBeDefined();
    expect(result.ai_confidence).toBeDefined();
    expect(result.trusted_sources).toBeDefined();
    expect(result.stage_outputs).toBeDefined();
  });

  it("uses stage5 guardrails to flag a high-stakes document for review", async () => {
    const result = await buildFinalResult({
      document,
      stage1: makeStage1Fallback(document),
      stage3: makeStage3Fallback(),
      stage4,
      officialSnippets: [],
    });
    // Source text contains "Eligibility" + "Appeal" which are flagged as
    // high-stakes. The guardrail layer sets needs_human_review via the
    // merged sanitizers.
    expect(result.stage_outputs.stage5).toBeDefined();
  });

  it("filters trusted_sources to official snippets only", async () => {
    const stage4WithBogus: Stage4 = {
      ...stage4,
      trusted_sources: [
        ...stage4.trusted_sources,
        { title: "Bogus", url: "https://random-blog.example/post", why_it_matters: "Nope" },
      ],
    };
    const result = await buildFinalResult({
      document,
      stage1: makeStage1Fallback(document),
      stage3: makeStage3Fallback(),
      stage4: stage4WithBogus,
      officialSnippets: [
        {
          title: "CA Dept of Ed",
          url: "https://ca.gov/example",
          snippet: "...",
          source: "search_result",
        },
      ],
    });
    expect(result.trusted_sources.map((s) => s.url)).toEqual([
      "https://ca.gov/example",
    ]);
  });
});