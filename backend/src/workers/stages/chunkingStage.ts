import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage, reportProgress } from "../stageReporter";
import { buildChunks } from "../../services/ingestion/buildChunks";
import { embedBatch } from "../../services/ingestion/embeddingProvider";
import { withTransaction } from "../../db/pool";
import {
  persistSections,
  persistChunks,
  persistFacts,
  clearDerivedRecords,
} from "../../services/ingestion/persistence";
import type { AnalysisState } from "./types";

export async function processChunkingStage(
  state: AnalysisState,
): Promise<AnalysisState> {
  const { job, workerId, summary, sections, facts } = state;
  let { currentStatus } = state;
  const { documentId, userId } = job.data;

  if (!isStageCompleteOrPast(currentStatus, "CHUNKING")) {
    await reportStage({
      documentId,
      userId,
      workerId,
      toStatus: "CHUNKING",
      eventType: "chunking_completed",
      message:
        "Building hierarchical chunks (document → section → paragraph → sentence)",
      progress: 52,
    });

    const chunks = buildChunks({
      documentSummary: summary || "",
      sections: sections || [],
    });

    const chunksByLevel = chunks.reduce<Record<string, number>>((acc, c) => {
      acc[c.chunkLevel] = (acc[c.chunkLevel] ?? 0) + 1;
      return acc;
    }, {});

    await reportProgress({
      documentId,
      userId,
      stage: "CHUNKING",
      eventType: "chunking_completed",
      message: `Planned ${chunks.length} chunks — ${chunksByLevel["section"] ?? 0} sections, ${chunksByLevel["paragraph"] ?? 0} paragraphs, ${chunksByLevel["sentence"] ?? 0} sentences`,
      progress: 54,
      payload: { total_chunks: chunks.length, by_level: chunksByLevel },
    });

    const PROGRESS_EVERY = Math.max(1, Math.floor(chunks.length / 20));
    const embeddings = await embedBatch(
      chunks.map((c) => c.content),
      async (completed, total) => {
        if (completed % PROGRESS_EVERY !== 0 && completed !== total) return;
        const pct = 55 + Math.round((completed / total) * 13);
        await reportProgress({
          documentId,
          userId,
          stage: "CHUNKING",
          eventType: "embedding_completed",
          message: `Embedding chunk ${completed}/${total} — bge-small-en-v1.5`,
          progress: pct,
          payload: {
            embedded: completed,
            total,
            by_level: chunksByLevel,
          },
        });
      },
    );

    await reportProgress({
      documentId,
      userId,
      stage: "CHUNKING",
      eventType: "embedding_completed",
      message: `All ${chunks.length} embeddings ready — writing to database`,
      progress: 68,
      payload: { total_chunks: chunks.length },
    });

    await withTransaction(async (client) => {
      await clearDerivedRecords(client, documentId);
      const sectionIdMap = await persistSections(
        client,
        documentId,
        sections || [],
      );
      await persistFacts(client, documentId, facts || []);
      await persistChunks(client, documentId, chunks, sectionIdMap, embeddings);
    });

    await reportProgress({
      documentId,
      userId,
      stage: "CHUNKING",
      eventType: "chunking_completed",
      message: `Chunking complete — ${chunks.length} chunks stored with embeddings`,
      progress: 72,
      payload: { total_chunks: chunks.length, by_level: chunksByLevel },
    });

    currentStatus = "CHUNKING";
  }

  return { ...state, currentStatus };
}
