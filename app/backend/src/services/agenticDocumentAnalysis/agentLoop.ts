import { askGroqJsonWithToolsStreaming } from "../documentAnalysisPipeline/llmClient";
import type { NormalizedDocument } from "../../types/documentAnalysis";
import {
  buildAgentSystemPrompt,
  buildAgentInitialTask,
} from "./systemPrompt";
import type {
  AccumulatedStageOutputs,
  AgentConfig,
  AgenticRunResult,
  AgentMessage,
  AgentToolContext,
  AgentTrajectory,
  AgentTrajectoryStep,
  FinalPayload,
} from "./types";
import { buildToolCatalog, findTool } from "./tools";
import type { OfficialSourceSnippet } from "../officialSourceSearch";

export interface AgentLoopParams {
  document: NormalizedDocument;
  config: AgentConfig;
  /** Pre-collected snippets (from pre-loop indexing) so the first turn
   *  can already use them. The web_search tool appends to this set. */
  initialSnippets?: OfficialSourceSnippet[];
}

/** Race a promise against a timeout, surfacing a clean error. */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}

/** Clip a tool result to a hard char budget. */
function truncateObservation(raw: unknown, max: number): { text: string; truncated: boolean } {
  const text = JSON.stringify(raw ?? null, null, 2);
  if (text.length <= max) return { text, truncated: false };
  const slice = text.slice(0, Math.max(0, max - 60));
  return {
    text: `${slice}\n\n…[truncated to ${max} chars]…`,
    truncated: true,
  };
}

/**
 * The agent loop. Each outer iteration is one full LLM turn: a single
 * model call whose response may contain 0..N tool_calls. We dispatch
 * every tool_call the model emits in parallel (Promise.all), then
 * append the tool results as `role: "tool"` messages and call the
 * model again.
 *
 * Termination conditions:
 *   1. The model calls a tool with `terminal: true` (finalize).
 *   2. We hit `config.maxIterations` (loop falls back to a deterministic
 *      synthesis so the run still produces a valid DocumentAnalysisPipelineResult).
 *   3. Same `{name, args}` signature appears 3+ turns in a row — treated
 *      as a stuck loop and synthesizes a fallback.
 *   4. Outer wall-clock cap.
 */
export async function runAgentLoop(params: AgentLoopParams): Promise<AgenticRunResult> {
  const { document, config } = params;
  const startMs = Date.now();

  const catalog = buildToolCatalog();

  const ctx: AgentToolContext = {
    document,
    emit: async () => {
      /* default no-op; real emit is injected by runClearPathAgenticPipeline */
    },
    officialSnippets: [...(params.initialSnippets ?? [])],
    accumulated: {} as AccumulatedStageOutputs,
    config,
  };

  const messages: AgentMessage[] = [
    { role: "system", content: buildAgentSystemPrompt() },
    { role: "user", content: buildAgentInitialTask(document) },
  ];

  const trajectorySteps: AgentTrajectoryStep[] = [];
  const signatureCounts = new Map<string, number>();
  let finalPayload: FinalPayload | null = null;
  let finishReason: AgentTrajectory["finishReason"] = "max_iterations";

  for (let turn = 0; turn < config.maxIterations; turn++) {
    if (Date.now() - startMs > config.totalTimeoutMs) {
      finishReason = "aborted";
      break;
    }

    const streamResult = await withTimeout(
      askGroqJsonWithToolsStreaming(
        messages.map(serialiseToChatMessage),
        catalog.tools,
        config.temperature,
        "agent-loop",
        undefined,
        config.totalTimeoutMs,
      ),
      Math.min(config.totalTimeoutMs, 60000),
      `agent-turn-${turn}`,
    );

    if (!streamResult || streamResult.kind === "error") {
      // Don't abort — return what we have so the caller can synthesize a fallback.
      finishReason = "error";
      break;
    }

    const toolCalls = streamResult.tool_calls;
    if (toolCalls.length === 0) {
      // Model decided not to call any tool. Treat as an empty turn — loop again
      // so the model has another chance to call finalize. If it keeps emitting
      // no tools we'll hit max-iterations and synthesize a fallback.
      continue;
    }

    // Append the assistant turn to the message log.
    messages.push({
      role: "assistant",
      content: streamResult.content,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    });

    // Dispatch every tool call the model emitted in one assistant turn
    // IN PARALLEL. Tools within a turn are independent I/O (vector
    // search, web search, sections) so parallelising halves wall time
    // without compromising determinism.
    const dispatched = await Promise.all(
      toolCalls.map(async (tc) => {
        const toolStart = Date.now();
        const signature = `${tc.name}:${JSON.stringify(tc.arguments ?? {})}`;
        signatureCounts.set(
          signature,
          (signatureCounts.get(signature) ?? 0) + 1,
        );

        // Loop detection: if the same signature shows up 3 times,
        // we conclude the model is stuck and stop dispatching further
        // copies this turn.
        const isLooping = (signatureCounts.get(signature) ?? 0) >= 3;

        const tool = findTool(catalog, tc.name);
        if (!tool) {
          const step: AgentTrajectoryStep = {
            turn,
            tool: tc.name,
            argsPreview: JSON.stringify(tc.arguments ?? {}).slice(0, 200),
            resultPreview: `unknown_tool`,
            truncated: false,
            latencyMs: 0,
            ok: false,
            error: "unknown_tool",
          };
          trajectorySteps.push(step);
          return {
            tool_call_id: tc.id,
            content: JSON.stringify({
              ok: false,
              error:
                "unknown_tool: choose one of the tools listed in your system prompt.",
            }),
          };
        }

        const paramsParse = tool.paramsSchema.safeParse(tc.arguments);
        if (!paramsParse.success) {
          const step: AgentTrajectoryStep = {
            turn,
            tool: tc.name,
            argsPreview: JSON.stringify(tc.arguments ?? {}).slice(0, 200),
            resultPreview: "validation_error",
            truncated: false,
            latencyMs: Date.now() - toolStart,
            ok: false,
            error: paramsParse.error.message,
          };
          trajectorySteps.push(step);
          return {
            tool_call_id: tc.id,
            content: JSON.stringify({
              ok: false,
              error: `argument_validation_error: ${paramsParse.error.message}`,
            }),
          };
        }

        if (isLooping) {
          return {
            tool_call_id: tc.id,
            content: JSON.stringify({
              ok: false,
              error:
                "loop_detected: you have called this tool with the same arguments three times. Call a different tool or call finalize.",
            }),
          };
        }

        // Emit the start-frame and run the tool.
        await ctx.emit({
          documentId: document.document_id,
          userId: document.user_id,
          eventType: tool.sseEvent.start,
          stage: "AI_PROCESSING",
          message: `Running ${tc.name}`,
          progress: estimateProgressForTool(tc.name, turn, config.maxIterations),
          payload: { tool: tc.name, turn },
        });

        let toolResult: unknown;
        let toolOk = true;
        let toolError: string | undefined;
        try {
          toolResult = await withTimeout(
            tool.handler(paramsParse.data as never, ctx),
            config.perToolTimeoutMs,
            `${tc.name}`,
          );
        } catch (err) {
          toolOk = false;
          toolError = err instanceof Error ? err.message : String(err);
        }

        // If the tool is the terminal one, capture its result.
        if (tool.terminal && toolOk) {
          finalPayload = toolResult as FinalPayload;
        }

        const observation = truncateObservation(toolResult, config.maxToolResultChars);

        await ctx.emit({
          documentId: document.document_id,
          userId: document.user_id,
          eventType: tool.sseEvent.complete,
          stage: "AI_PROCESSING",
          message: `${tc.name} completed`,
          progress: estimateProgressForTool(tc.name, turn, config.maxIterations) + 3,
          payload: {
            tool: tc.name,
            turn,
            ok: toolOk,
            truncated: observation.truncated,
            ...(toolError ? { error: toolError } : {}),
          },
        });

        const step: AgentTrajectoryStep = {
          turn,
          tool: tc.name,
          argsPreview: JSON.stringify(tc.arguments ?? {}).slice(0, 200),
          resultPreview: observation.text.slice(0, 300),
          truncated: observation.truncated,
          latencyMs: Date.now() - toolStart,
          ok: toolOk,
          ...(toolError ? { error: toolError } : {}),
        };
        trajectorySteps.push(step);

        return {
          tool_call_id: tc.id,
          content: toolOk
            ? observation.text
            : JSON.stringify({ ok: false, error: toolError ?? "tool_failed" }),
        };
      }),
    );

    // Append tool results so the model can read them on the next turn.
    for (const r of dispatched) {
      messages.push({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
    }

    if (finalPayload !== null) {
      finishReason = "terminal_tool";
      break;
    }
  }

  // If we exited because of a detected loop AND no tool finished
  // the run, override the finish reason.
  if (finishReason === "max_iterations" && finalPayload === null) {
    const anyStuck = Array.from(signatureCounts.values()).some((v) => v >= 3);
    if (anyStuck) finishReason = "loop_detected";
  }

  const trajectory: AgentTrajectory = {
    totalTurns: trajectorySteps.length > 0
      ? trajectorySteps[trajectorySteps.length - 1]!.turn + 1
      : 0,
    steps: trajectorySteps,
    finishReason,
    totalDurationMs: Date.now() - startMs,
    totalToolLatencyMs: trajectorySteps.reduce((acc, s) => acc + s.latencyMs, 0),
  };

  return { trajectory, finalPayload };
}

function serialiseToChatMessage(m: AgentMessage): { role: "system" | "user" | "assistant"; content: string } {
  // We serialise conversation history down to the simple shape Groq
  // expects for the NEXT request — tool/tool_calls are re-inserted by
  // the loop; we just need plain text content for re-input.
  if (m.role === "system" || m.role === "user") return { role: m.role, content: m.content };
  if (m.role === "assistant") return { role: "assistant", content: m.content ?? "" };
  // 'tool' messages get inlined as a 'user' turn — Groq tool-result
  // messages require a tool_call_id we lose on round-trips, so the
  // model sees them as conversational observations.
  return { role: "user", content: `[tool result]\n${m.content}` };
}

/** Rough progress mapping so the UI bar moves forward across turns. */
function estimateProgressForTool(toolName: string, turn: number, maxTurns: number): number {
  const base = Math.min(85, 10 + Math.round((turn / maxTurns) * 75));
  const toolBias: Record<string, number> = {
    prepare_rag_index: 5,
    read_document_section: 8,
    search_document_chunks: 12,
    web_search: 15,
    extract_candidates: 18,
    verify_against_sources: 22,
    finalize: 25,
  };
  return Math.min(95, base + (toolBias[toolName] ?? 10));
}
