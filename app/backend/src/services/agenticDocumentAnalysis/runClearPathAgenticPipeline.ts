import { pgPool, withTransaction } from "../../db/pool";
import type {
  DocumentAnalysisPipelineResult,
  NormalizedDocument,
} from "../../types/documentAnalysis";
import type {
  AgenticPipelineOptions,
  AgentConfig,
  FinalPayload,
} from "./types";
import type { PipelineEventEmitter } from "../documentAnalysisPipeline/types";
import type { Stage5 } from "../documentAnalysisPipeline/schemas";
import {
  makeStage3Fallback,
  makeStage4Fallback,
} from "../documentAnalysisPipeline/fallbacks";
import { runAgentLoop } from "./agentLoop";
import {
  buildFinalResult,
  synthesizeStage4Fallback,
} from "./finalize";

export const CLEARPATH_AGENTIC_PIPELINE_VERSION = "2026-08-25-agentic";

export function defaultAgentConfig(
  options: AgenticPipelineOptions = {},
): AgentConfig {
  return {
    maxIterations: options.maxIterations ?? 8,
    maxToolResultChars: options.maxToolResultChars ?? 1500,
    perToolTimeoutMs: options.perToolTimeoutMs ?? 22000,
    totalTimeoutMs: options.totalTimeoutMs ?? 180000,
    maxTavilyQueries: options.maxTavilyQueries ?? 3,
    ragChunkCap: options.ragChunkCap ?? 256,
    temperature: options.temperature ?? 0,
  };
}

/**
 * Public entry point for the agentic pipeline. Mirrors the
 * `runClearPathPipeline(document, options, emit)` signature so the
 * orchestrator can dispatch between the two without a fan-out.
 *
 * Flow:
 *   1. Eagerly prepare the RAG index if `document_chunks` is empty.
 *   2. Run the agent loop with the chosen config.
 *   3. If the agent called `finalize` → use its Stage 4 payload.
 *   4. Otherwise → synthesize a Stage 4 from accumulated stage3 via
 *      `buildStage4Prompt` (same as classic pipeline's max-iters path).
 *   5. Pipe through `buildFinalResult` to produce the identical
 *      `DocumentAnalysisPipelineResult` shape.
 */
export async function runClearPathAgenticPipeline(
  document: NormalizedDocument,
  options: AgenticPipelineOptions = {},
  emit?: PipelineEventEmitter,
): Promise<DocumentAnalysisPipelineResult> {
  const config = defaultAgentConfig(options);

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_analysis_started",
    stage: "AI_PROCESSING",
    message: `Agentic pipeline ${CLEARPATH_AGENTIC_PIPELINE_VERSION} starting`,
    progress: 5,
    payload: {
      pipeline: "agentic",
      version: CLEARPATH_AGENTIC_PIPELINE_VERSION,
      maxIterations: config.maxIterations,
    },
  });

  // 1. Eagerly ensure RAG index exists.
  const initialSnippets: Awaited<ReturnType<typeof prepareChunksIfMissing>> =
    await prepareChunksIfMissing(document, emit, config.ragChunkCap);

  // Run the agent loop.
  const loopResult = await runAgentLoop({
    document,
    config,
    initialSnippets: initialSnippets.snippets,
  });

  // Wire emit into ctx (we couldn't do it before because tools catalog
  // is built before the run). The agentLoop intentionally accepts an
  // emit-less ctx — it only emits start/complete frames for each tool
  // through the orchestrator's emit callback. Therefore we re-emit the
  // trajectory as a single batch at the end so the SSE stream still
  // carries progress after the loop closes.
  if (emit) {
    await emit({
      documentId: document.document_id,
      userId: document.user_id,
      eventType: "ai_safety_started",
      stage: "AI_PROCESSING",
      message: "Running deterministic safety review",
      progress: 90,
      payload: {
        trajectory_turns: loopResult.trajectory.totalTurns,
        trajectory_finish: loopResult.trajectory.finishReason,
      },
    });
  }

  // Decide what Stage 4 payload to use.
  let stage4Input: import("../documentAnalysisPipeline/schemas").Stage4;
  let accumulatedSnippets = initialSnippets.snippets;

  if (loopResult.finalPayload) {
    stage4Input = loopResult.finalPayload.stage4;
    if (loopResult.finalPayload.officialSnippets) {
      accumulatedSnippets = loopResult.finalPayload.officialSnippets;
    }
  } else {
    // Fallback: synthesize Stage 4 from whatever we accumulated.
    if (loopResult.trajectory.finishReason === "loop_detected") {
      console.warn(
        `[agentic] Loop detected after ${loopResult.trajectory.totalTurns} turns; synthesizing fallback Stage 4.`,
      );
    } else if (loopResult.trajectory.finishReason === "error") {
      console.warn(
        `[agentic] Loop errored; synthesizing fallback Stage 4 from accumulated state.`,
      );
    }

    try {
      stage4Input = await synthesizeStage4Fallback({
        document,
        stage3: initialSnippets.accumulatedStage3 ?? makeStage3Fallback(),
        officialSnippets: accumulatedSnippets,
      });
    } catch (err) {
      console.warn(
        `[agentic] Synthesis fallback failed, using schema fallback:`,
        err,
      );
      stage4Input = makeStage4Fallback(document);
    }
  }

  // 5. Deterministic post-merge.
  const result = await buildFinalResult({
    document,
    stage2: initialSnippets.accumulatedStage2,
    stage3: initialSnippets.accumulatedStage3,
    stage4: stage4Input,
    officialSnippets: accumulatedSnippets,
  });

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_safety_completed",
    stage: "AI_PROCESSING",
    message: "Safety review complete",
    progress: 95,
    payload: {
      trajectory: {
        turns: loopResult.trajectory.totalTurns,
        total_duration_ms: loopResult.trajectory.totalDurationMs,
        finish_reason: loopResult.trajectory.finishReason,
        step_summary: loopResult.trajectory.steps.map((s) => ({
          tool: s.tool,
          ok: s.ok,
          latency_ms: s.latencyMs,
          truncated: s.truncated,
        })),
      },
      recommendation: (result.stage_outputs.stage5 as Stage5).final_recommendation,
    },
  });

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_completed",
    stage: "AI_PROCESSING",
    message: "AI analysis complete",
    progress: 100,
    payload: {
      status: result.status,
      action_item_count: result.action_items.length,
      deadline_count: result.key_deadlines.length,
      trusted_source_count: result.trusted_sources.length,
      official_source_count: accumulatedSnippets.length,
      guardrail_recommendation: (result.stage_outputs.stage5 as Stage5).final_recommendation,
      pipeline: "agentic",
      pipeline_version: CLEARPATH_AGENTIC_PIPELINE_VERSION,
      trajectory_finish_reason: loopResult.trajectory.finishReason,
    },
  });

  // Console-log the trajectory for backend observability without
  // surfacing it in the SSE stream.
  console.log(
    `[agentic] trajectory: ${JSON.stringify({
      event: "agent_trajectory",
      documentId: document.document_id,
      turns: loopResult.trajectory.totalTurns,
      finishReason: loopResult.trajectory.finishReason,
      totalDurationMs: loopResult.trajectory.totalDurationMs,
      tools: loopResult.trajectory.steps.map((s) => s.tool),
    })}`,
  );

  return result;
}

/**
 * Build + embed the document's RAG index if it doesn't already exist.
 * Returns any accumulated snippets (currently empty — retrieval happens
 * on demand through the search_document_chunks tool) plus any partial
 * stage3 the indexer may have pre-computed (currently none — the tool
 * produces stage3 on demand, not eagerly).
 */
async function prepareChunksIfMissing(
  document: NormalizedDocument,
  emit: PipelineEventEmitter | undefined,
  ragChunkCap: number,
): Promise<{
  snippets: import("../officialSourceSearch").OfficialSourceSnippet[];
  accumulatedStage2?: never;
  accumulatedStage3?: never;
}> {
  const count = await pgPool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM document_chunks WHERE document_id = $1`,
    [document.document_id],
  );

  if ((count.rows[0]?.c ?? 0) >= 16) {
    return { snippets: [] };
  }

  await emit?.({
    documentId: document.document_id,
    userId: document.user_id,
    eventType: "ai_understanding_started",
    stage: "AI_PROCESSING",
    message: "Preparing RAG index",
    progress: 7,
    payload: { stage: 1, total: 5, sub_step: "rag_index" },
  });

  try {
    const { buildDocumentStructure } = await import("../ingestion/buildStructure");
    const { buildChunks } = await import("../ingestion/buildChunks");
    const { embedBatch } = await import("../ingestion/embeddingProvider");
    const { persistChunks, persistSections } = await import("../ingestion/persistence");

    const sections = buildDocumentStructure(document.source_text ?? "");
    const summary = (document.source_text ?? "").slice(0, 500);
    const chunks = buildChunks({ documentSummary: summary, sections }).slice(0, ragChunkCap);

    let completed = 0;
    const embeddings = await embedBatch(chunks.map((c) => c.content), async (done, total) => {
      completed = done;
      if (emit && (done % 8 === 0 || done === total)) {
        await emit({
          documentId: document.document_id,
          userId: document.user_id,
          eventType: "ai_understanding_started",
          stage: "AI_PROCESSING",
          message: `Embedding chunks (${done}/${total})`,
          progress: 7 + Math.min(5, Math.round((done / total) * 5)),
          payload: {
            stage: 1,
            total: 5,
            sub_step: "rag_index",
            done_count: done,
            total_count: total,
          },
        });
      }
    });

    await withTransaction(async (client) => {
      const sectionIdMap = await persistSections(client, document.document_id, sections);
      await persistChunks(client, document.document_id, chunks, sectionIdMap, embeddings);
    });

    await emit?.({
      documentId: document.document_id,
      userId: document.user_id,
      eventType: "ai_understanding_completed",
      stage: "AI_PROCESSING",
      message: `RAG index ready — ${chunks.length} chunks embedded`,
      progress: 12,
      payload: { stage: 1, total: 5, sub_step: "rag_index", chunk_count: chunks.length },
    });
  } catch (err) {
    console.warn(`[agentic] Failed to prepare RAG index (continuing without):`, err);
    await emit?.({
      documentId: document.document_id,
      userId: document.user_id,
      eventType: "ai_understanding_completed",
      stage: "AI_PROCESSING",
      message: "RAG index step skipped — continuing with document-text only retrieval",
      progress: 12,
      payload: { stage: 1, total: 5, sub_step: "rag_index", skipped: true },
    });
  }

  return { snippets: [] };
}
