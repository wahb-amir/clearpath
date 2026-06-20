import { type Job } from "bullmq";
import { env } from "../config/env";
import { pgPool } from "../db/pool";
import { pipelineIndex } from "../types/pipelineStatus";
import type { AiAnalysisJobData, DocumentRow } from "../types/dtos";
import { reportStage, reportProgress, reportFailure } from "./stageReporter";
import { runAndPersistDocumentAnalysis } from "../services/documentAnalysisOrchestrator";

export async function runAiPipeline(
  job: Job<AiAnalysisJobData>,
): Promise<void> {
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

  // Guard: only proceed if the document has reached the AI-ready stage.
  // If it is still in preprocessing (before PREPROCESSING_COMPLETED) it
  // means the AI job was queued prematurely (e.g. stale outbox event or
  // duplicate BullMQ job). Log and bail — the preprocessing worker will
  // insert a fresh outbox event once it actually finishes.
  const AI_READY_INDEX = pipelineIndex("PREPROCESSING_COMPLETED");
  const currentIndex = pipelineIndex(doc.analysis_status as any);
  if (currentIndex !== -1 && currentIndex < AI_READY_INDEX) {
    console.warn(
      `[ai-analysis] Skipping job ${job.id}: document ${documentId} is at ` +
        `${doc.analysis_status} — preprocessing not yet complete. ` +
        `AI job will be re-queued by the preprocessing worker.`,
    );
    return;
  }

  if (doc.analysis_status === "FAILED" || doc.analysis_status === "CANCELLED") {
    console.warn(
      `[ai-analysis] Skipping job ${job.id}: document ${documentId} is in terminal state ${doc.analysis_status}`,
    );
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

  try {
    // runAndPersistDocumentAnalysis owns all mid-pipeline SSE events via its
    // internal emit callback (stages 1-5, per-token streaming ticks, search
    // progress, etc).  Do NOT emit "understanding_started" or "synthesis_started"
    // here — they would fire BEFORE the pipeline runs and create a false 55-second
    // silent gap between the wrapper event and the real work beginning.
    const result = await runAndPersistDocumentAnalysis({
      analysisRequestId,
      documentId,
      userId,
      fileType: doc.mime_type,
      language: doc.language,
    });

    if (result.human_review.required) {
      await reportProgress({
        documentId,
        userId,
        stage: "AI_PROCESSING",
        eventType: "ai_human_review_required",
        message: result.human_review.reason,
        progress: 90,
        payload: { reason: result.human_review.reason },
      });
    }

    await reportStage({
      documentId,
      userId,
      workerId: env.WORKER_ID,
      toStatus: "AI_COMPLETED",
      eventType: "ai_completed",
      message: "AI analysis completed",
      progress: 100,
      payload: {
        analysisVersion,
        summary: result.summary,
        actionItems: result.action_items,
        keyDeadlines: result.key_deadlines,
        questionsToAsk: result.questions_to_ask,
        aiConfidence: result.ai_confidence,
        trustedSources: result.trusted_sources,
        humanReview: result.human_review,
        status: result.status,
      },
    });

    await reportStage({
      documentId,
      userId,
      workerId: env.WORKER_ID,
      toStatus: "COMPLETED",
      eventType: "analysis_completed",
      message:
        result.status === "review_required"
          ? "Analysis completed - human review recommended"
          : "Analysis completed",
      progress: 100,
      payload: {
        analysisVersion,
        summary: result.summary,
        actionItems: result.action_items,
        keyDeadlines: result.key_deadlines,
        questionsToAsk: result.questions_to_ask,
        aiConfidence: result.ai_confidence,
        trustedSources: result.trusted_sources,
        humanReview: result.human_review,
        status: result.status,
      },
    });
  } catch (error) {
    await reportFailure({
      documentId,
      analysisRequestId,
      userId,
      workerId: env.WORKER_ID,
      error,
    });
    throw error;
  }
}
