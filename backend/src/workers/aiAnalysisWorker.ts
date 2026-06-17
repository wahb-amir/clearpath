import { ConnectionOptions, Worker, type Job } from "bullmq";
import { createWorkerConnection } from "../redis/connection";
import { env } from "../config/env";
import { pgPool, withTransaction } from "../db/pool";
import type { AiAnalysisJobData, DocumentRow } from "../types/dtos";
import { reportStage, reportProgress, reportFailure } from "./stageReporter";

// plug your actual AI pipeline implementation here
export async function runAiPipeline(job: Job<AiAnalysisJobData>): Promise<void> {
  const { documentId, analysisRequestId, userId, analysisVersion } = job.data;

  const docResult = await pgPool.query<DocumentRow>(
    `SELECT * FROM documents WHERE id = $1`,
    [documentId],
  );
  if (docResult.rowCount === 0) return;

  const doc = docResult.rows[0];

  if (doc.analysis_status === "COMPLETED") {
    return;
  }

  await pgPool.query(
    `
    UPDATE document_analysis_requests
       SET status = 'AI_PROCESSING',
           worker_id = $1,
           started_at = COALESCE(started_at, now())
     WHERE id = $2
    `,
    [env.WORKER_ID, analysisRequestId],
  );

  await reportStage({
    documentId,
    userId,
    workerId: env.WORKER_ID,
    toStatus: "AI_PROCESSING",
    eventType: "ai_analysis_started",
    message: "AI analysis started",
    progress: 5,
  });

  // TODO: call your guardrailed Groq + search pipeline here
  const finalResult = {
    summary: "placeholder",
    action_items: [],
    key_deadlines: [],
    questions_to_ask: [],
    ai_confidence: { overall: 0.5 },
    trusted_sources: [],
    human_review: { required: true, reason: "AI pipeline not yet wired" },
  };

  await withTransaction(async (client) => {
    await client.query(
      `
      INSERT INTO document_analysis_results (
        analysis_request_id,
        document_id,
        user_id,
        status,
        summary,
        action_items,
        key_deadlines,
        questions_to_ask,
        ai_confidence,
        trusted_sources,
        human_review,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'completed', $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, now(), now())
      ON CONFLICT (analysis_request_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        summary = EXCLUDED.summary,
        action_items = EXCLUDED.action_items,
        key_deadlines = EXCLUDED.key_deadlines,
        questions_to_ask = EXCLUDED.questions_to_ask,
        ai_confidence = EXCLUDED.ai_confidence,
        trusted_sources = EXCLUDED.trusted_sources,
        human_review = EXCLUDED.human_review,
        updated_at = now()
      `,
      [
        analysisRequestId,
        documentId,
        userId,
        finalResult.summary,
        JSON.stringify(finalResult.action_items),
        JSON.stringify(finalResult.key_deadlines),
        JSON.stringify(finalResult.questions_to_ask),
        JSON.stringify(finalResult.ai_confidence),
        JSON.stringify(finalResult.trusted_sources),
        JSON.stringify(finalResult.human_review),
      ],
    );

    await client.query(
      `
      UPDATE documents
         SET analysis_status = 'COMPLETED',
             current_stage = 'COMPLETED',
             worker_id = $1
       WHERE id = $2
      `,
      [env.WORKER_ID, documentId],
    );

    await client.query(
      `
      UPDATE document_analysis_requests
         SET status = 'COMPLETED',
             finished_at = now()
       WHERE id = $1
      `,
      [analysisRequestId],
    );

    const { insertPipelineEvent } =
      await import("../services/analysisRequestService");
    await insertPipelineEvent(client, {
      documentId,
      userId,
      eventType: "ai_completed",
      stage: "COMPLETED",
      message: "AI analysis completed",
      progress: 100,
      payload: finalResult,
    });
  });

  await reportProgress({
    documentId,
    userId,
    stage: "COMPLETED",
    eventType: "ai_completed",
    message: "AI analysis completed",
    progress: 100,
    payload: { analysisVersion, result: finalResult },
  });
}

export function createAiAnalysisWorker(p0: Job<AiAnalysisJobData, any, string>): Worker<AiAnalysisJobData> {
  const worker = new Worker<AiAnalysisJobData>(
    env.ANALYSIS_QUEUE_NAME,
    async (job: Job<AiAnalysisJobData>) => {
      if (job.name !== "ai-analysis") return;
      await runAiPipeline(job);
    },
    {
      connection: createWorkerConnection() as ConnectionOptions,
      concurrency: 1,
      lockDuration: 10 * 60 * 1000,
    },
  );

  worker.on("active", (job) => {
    console.log("[ai-worker] ACTIVE", job.id);
  });

  worker.on("completed", (job) => {
    console.log("[ai-worker] COMPLETED", job.id);
  });

  worker.on("failed", (job, err) => {
    console.error("[ai-worker] FAILED", job?.id, err);
  });

  return worker;
}
