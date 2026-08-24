import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NormalizedDocument } from "../../../types/documentAnalysis";

/**
 * Mock the LLM client BEFORE importing the agent loop so the mock is
 * in place when the module reads askGroqJsonWithToolsStreaming at call
 * time. vi.mock is hoisted — we can't reference top-level `const`
 * variables inside the factory. Use vi.hoisted to share a mock fn.
 */
const { mockAskGroqJsonWithToolsStreaming } = vi.hoisted(() => ({
  mockAskGroqJsonWithToolsStreaming: vi.fn(),
}));

vi.mock("../../documentAnalysisPipeline/llmClient", () => ({
  askGroqJsonStreaming: vi.fn(),
  askGroqJsonWithToolsStreaming: mockAskGroqJsonWithToolsStreaming,
}));

// Mock the ingestion helpers so prepareChunksIfMissing doesn't touch DB.
vi.mock("../../../db/pool", () => ({
  pgPool: { query: vi.fn() },
  withTransaction: vi.fn(async (_fn: any) => undefined),
}));

// Mock retrieval to return empty so we don't hit pgvector.
vi.mock("../../retrieval/router", () => ({
  retrieveForQuery: vi.fn(async () => ({
    intent: "fallback" as const,
    chunks: [],
    facts: [],
  })),
}));

// Mock officialSourceSearch so web_search tool doesn't hit Tavily.
vi.mock("../../officialSourceSearch", () => ({
  searchMany: vi.fn(async () => []),
  isTrustedOfficialUrl: vi.fn(() => false),
}));

// Now import the loop after mocks.
import { runAgentLoop } from "../agentLoop";
import type { AgentConfig } from "../types";

const document: NormalizedDocument = {
  document_id: "00000000-0000-0000-0000-000000000001",
  user_id: "user-1",
  file_type: "application/pdf",
  language: "en",
  source_text: "This is a notice about benefits. Respond within 5 days.",
  sections: [],
  entities: { dates: [], contacts: [], urls: [], names: [] },
};

const config: AgentConfig = {
  maxIterations: 4,
  maxToolResultChars: 5000,
  perToolTimeoutMs: 5000,
  totalTimeoutMs: 30000,
  maxTavilyQueries: 3,
  ragChunkCap: 256,
  temperature: 0,
};

beforeEach(() => {
  mockAskGroqJsonWithToolsStreaming.mockReset();
});

describe("agent loop", () => {
  it("terminates when the model calls finalize", async () => {
    mockAskGroqJsonWithToolsStreaming.mockResolvedValueOnce({
      kind: "ok",
      content: null,
      tool_calls: [
        {
          id: "tc-1",
          name: "finalize",
          arguments: {
            ai_summary: "Summary",
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
          },
        },
      ],
      finishReason: "tool_calls",
    });

    const result = await runAgentLoop({ document, config });
    expect(result.trajectory.finishReason).toBe("terminal_tool");
    expect(result.finalPayload).not.toBeNull();
    expect(result.finalPayload?.stage4.ai_summary).toBe("Summary");
  });

  it("falls back after max-iterations when model never calls finalize", async () => {
    // Return one non-terminal tool call every turn, varying args so the
    // loop detection (3x same signature) doesn't kick in.
    let counter = 0;
    mockAskGroqJsonWithToolsStreaming.mockImplementation(async () => {
      const myCounter = counter++;
      return {
        kind: "ok",
        content: null,
        tool_calls: [
          {
            id: `tc-${myCounter}`,
            name: "read_document_section",
            arguments: { from: myCounter },
          },
        ],
        finishReason: "tool_calls",
      };
    });

    const result = await runAgentLoop({ document, config });
    expect(result.trajectory.finishReason).toBe("max_iterations");
    expect(result.finalPayload).toBeNull();
    // We made at most maxIterations (4) LLM calls.
    expect(mockAskGroqJsonWithToolsStreaming.mock.calls.length).toBeLessThanOrEqual(
      config.maxIterations,
    );
  });

  it("returns error result when LLM throws", async () => {
    mockAskGroqJsonWithToolsStreaming.mockResolvedValueOnce({
      kind: "error",
      error: "boom",
    });

    const result = await runAgentLoop({ document, config });
    expect(result.trajectory.finishReason).toBe("error");
    expect(result.finalPayload).toBeNull();
  });

  it("treats unknown tool names as recoverable errors", async () => {
    mockAskGroqJsonWithToolsStreaming
      .mockResolvedValueOnce({
        kind: "ok",
        content: null,
        tool_calls: [
          {
            id: "tc-x",
            name: "fake_tool",
            arguments: {},
          },
        ],
        finishReason: "tool_calls",
      })
      // Second turn: still nothing useful, then we hit max-iter.
      .mockResolvedValue({
        kind: "ok",
        content: null,
        tool_calls: [],
        finishReason: "stop",
      });

    const result = await runAgentLoop({ document, config });
    expect(
      result.trajectory.steps.some((s) => s.tool === "fake_tool" && !s.ok),
    ).toBe(true);
  });
});