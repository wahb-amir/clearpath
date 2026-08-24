import type { z } from "zod";
import type {
  NormalizedDocument,
  PipelineStageOutputs,
} from "../../types/documentAnalysis";
import type { Stage2, Stage3, Stage4 } from "../documentAnalysisPipeline/schemas";
import type {
  OfficialSourceSnippet,
  PlannedSearch,
} from "../officialSourceSearch";
import type { PipelineEventEmitter } from "../documentAnalysisPipeline/types";

/**
 * The agent's runtime context — everything it needs to do work without
 * depending on module-level imports. Constructed once per run.
 */
export interface AgentToolContext {
  document: NormalizedDocument;
  emit: PipelineEventEmitter;
  /** Snippets collected so far via web_search. May grow over the run. */
  officialSnippets: OfficialSourceSnippet[];
  /** Accumulated stage outputs from prior tools (extract/verify etc). */
  accumulated: AccumulatedStageOutputs;
  /** Runtime config knobs. */
  config: AgentConfig;
}

export interface AccumulatedStageOutputs {
  stage1?: import("../documentAnalysisPipeline/schemas").Stage1;
  stage2?: Stage2;
  stage3?: Stage3;
}

export interface AgentConfig {
  /** Hard cap on tool-call turns. */
  maxIterations: number;
  /** Per-tool-result char budget; longer results are clipped. */
  maxToolResultChars: number;
  /** Per-tool-call wall-clock cap (ms). */
  perToolTimeoutMs: number;
  /** Total agent wall-clock cap (ms). */
  totalTimeoutMs: number;
  /** Tavily max queries per web_search call. */
  maxTavilyQueries: number;
  /** RAG chunk-count ceiling when re-indexing. */
  ragChunkCap: number;
  /** LLM sampling temperature. */
  temperature: number;
}

/**
 * Generic tool descriptor. Handlers produce a JSON-serializable result;
 * `paramsSchema` validates the model's argument payload before the
 * handler runs.
 *
 * TParams is left as `unknown` in the array element type so a mixed
 * catalog (each tool has its own params schema) can be stored in one
 * array. Per-tool generics flow through the individual handlers.
 */
export interface AgentTool<
  TName extends string = string,
  TParams = unknown,
  TResult = unknown,
> {
  name: TName;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
  paramsSchema: z.ZodType<TParams>;
  handler: (
    args: TParams,
    ctx: AgentToolContext,
  ) => Promise<TResult>;
  /** SSE eventType strings emitted around this tool's execution. */
  sseEvent: {
    start: string;
    complete: string;
  };
  /** When the agent calls this tool the loop terminates. */
  terminal?: boolean;
}

/**
 * Final payload returned by the `finalize` tool (or the max-iters
 * synthesis fallback). It's the same shape the classic pipeline emits
 * for Stage 4, plus the snippet set we want to feed `sanitizeTrustedSources`.
 */
export interface FinalPayload {
  stage4: Stage4;
  /** Optional snippets the agent wants to whitelist for trusted_sources. */
  officialSnippets?: OfficialSourceSnippet[];
  /** Any additional context the agent wants to surface in the trajectory log. */
  notes?: string;
}

/**
 * One entry in the agent trajectory — surfaced in logs / future debug UI.
 */
export interface AgentTrajectoryStep {
  turn: number;
  tool: string;
  argsPreview: string;
  resultPreview: string;
  truncated: boolean;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

export interface AgentTrajectory {
  totalTurns: number;
  steps: AgentTrajectoryStep[];
  finishReason:
    | "terminal_tool"
    | "max_iterations"
    | "loop_detected"
    | "aborted"
    | "error";
  totalDurationMs: number;
  /** Cumulative tool-call wall-clock latency. */
  totalToolLatencyMs: number;
}

/**
 * Public options to `runClearPathAgenticPipeline`. Mirrors `PipelineOptions`
 * but adds agent-only knobs.
 */
export interface AgenticPipelineOptions {
  maxIterations?: number;
  maxToolResultChars?: number;
  perToolTimeoutMs?: number;
  totalTimeoutMs?: number;
  maxTavilyQueries?: number;
  ragChunkCap?: number;
  temperature?: number;
}

/**
 * Internal message format that mirrors Groq's chat-completion shape.
 * Kept distinct from `ChatMessage` (which only allows system|user|assistant)
 * so the agent loop can carry `tool` role messages back to the model.
 */
export type AgentMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

export interface AgenticRunResult {
  trajectory: AgentTrajectory;
  finalPayload: FinalPayload | null;
}

/**
 * Wrapper for `searchMany`'s expected input (named import shape) so tools
 * don't have to import it directly.
 */
export type AgentPlannedSearch = PlannedSearch;

export interface StageOutputsAccumulator {
  stage1?: import("../documentAnalysisPipeline/schemas").Stage1;
  stage2?: Stage2;
  stage3?: Stage3;
  snippets: OfficialSourceSnippet[];
}

/**
 * The orchestrator-wide output. Identical to
 * `DocumentAnalysisPipelineResult` — the agentic path produces this shape
 * so the frontend doesn't branch on pipeline type.
 */
export interface AgenticFinalResult {
  pipelineResult: import("../../types/documentAnalysis").DocumentAnalysisPipelineResult;
  stageOutputs: PipelineStageOutputs;
  trajectory: AgentTrajectory;
}
