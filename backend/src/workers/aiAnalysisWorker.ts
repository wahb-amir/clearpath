import { type Job } from "bullmq";
import { env } from "../config/env";
import { pgPool } from "../db/pool";
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

  if (doc.analysis_status === "FAILED" || doc.analysis_status === "CANCELLED") {
    // Document already reached a terminal state (e.g. a prior attempt
    // failed permanently). Don't retry into a dead end - BullMQ retries
    // would otherwise throw InvalidStateTransitionError forever.
    console.warn(
      `[ai-analysis] Skipping job ${job.id}: document ${documentId} is already ${doc.analysis_status}`,
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
    await reportProgress({
      documentId,
      userId,
      stage: "AI_PROCESSING",
      eventType: "ai_understanding_started",
      message: "Reading the document and identifying its purpose",
      progress: 15,
    });

    const result = await runAndPersistDocumentAnalysis({
      analysisRequestId,
      documentId,
      userId,
      fileType: doc.mime_type,
      language: doc.language,
    });

    await reportProgress({
      documentId,
      userId,
      stage: "AI_PROCESSING",
      eventType: "ai_synthesis_started",
      message: "Synthesizing the summary, action items, and deadlines",
      progress: 85,
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
