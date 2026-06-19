import type { PoolClient } from "pg";
import { pgPool, withTransaction } from "../db/pool";
import type {
  DocumentAnalysisPipelineResult,
  FinalDocumentAnalysisResult,
} from "../types/documentAnalysis";

export interface PersistedDocumentAnalysisRow extends FinalDocumentAnalysisResult {
  id: string;
  analysis_request_id: string;
  document_id: string;
  user_id: string;
  status: "pending" | "processing" | "completed" | "review_required" | "failed";
  model: string;
  stage_outputs: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertAnalysisResultInput {
  analysisRequestId: string;
  documentId: string;
  userId: string;
  model: string;
  result: DocumentAnalysisPipelineResult;
}

export async function loadAnalysisResultByRequestId(
  analysisRequestId: string,
): Promise<PersistedDocumentAnalysisRow | null> {
  const query = await pgPool.query<PersistedDocumentAnalysisRow>(
    `SELECT *
       FROM document_analysis_results
      WHERE analysis_request_id = $1
      LIMIT 1`,
    [analysisRequestId],
  );

  return query.rows[0] ?? null;
}

export async function getOrCreatePendingAnalysisResult(
  client: PoolClient,
  analysisRequestId: string,
  documentId: string,
  userId: string,
  model: string,
): Promise<void> {
  await client.query(
    `INSERT INTO document_analysis_results (
      analysis_request_id, document_id, user_id, model, status
    )
    VALUES ($1, $2, $3, $4, 'pending')
    ON CONFLICT (analysis_request_id)
    DO UPDATE SET
      document_id = EXCLUDED.document_id,
      user_id = EXCLUDED.user_id,
      model = EXCLUDED.model,
      updated_at = now()`,
    [analysisRequestId, documentId, userId, model],
  );
}
export async function updateActionItemCompletion(
  analysisRequestId: string,
  userId: string,
  itemIndex: number,
  isCompleted: boolean
): Promise<boolean> {
  // We construct the JSON path like '{0,completed}' to reach inside the array index
  const jsonPath = `{${itemIndex},completed}`;

  const result = await pgPool.query(
    `UPDATE document_analysis_results
        SET action_items = jsonb_set(action_items, $1::text[], to_jsonb($2::boolean)),
            updated_at = now()
      WHERE analysis_request_id = $3 
        AND user_id = $4
      RETURNING id`,
    [jsonPath, isCompleted, analysisRequestId, userId]
  );

  return (result.rowCount ?? 0) > 0;
}
export async function markAnalysisResultProcessing(
  client: PoolClient,
  analysisRequestId: string,
  model: string,
): Promise<void> {
  await client.query(
    `UPDATE document_analysis_results
        SET status = 'processing',
            model = $2,
            error_message = NULL,
            updated_at = now()
      WHERE analysis_request_id = $1`,
    [analysisRequestId, model],
  );
}

export async function finalizeAnalysisResult(
  client: PoolClient,
  input: UpsertAnalysisResultInput,
): Promise<void> {
  const status =
    input.result.status === "review_required" ? "review_required" : "completed";

  await client.query(
    `INSERT INTO document_analysis_results (
      analysis_request_id,
      document_id,
      user_id,
      model,
      status,
      summary,
      action_items,
      key_deadlines,
      questions_to_ask,
      ai_confidence,
      trusted_sources,
      human_review,
      stage_outputs,
      error_message,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
      NULL,
      now()
    )
    ON CONFLICT (analysis_request_id)
    DO UPDATE SET
      document_id = EXCLUDED.document_id,
      user_id = EXCLUDED.user_id,
      model = EXCLUDED.model,
      status = EXCLUDED.status,
      summary = EXCLUDED.summary,
      action_items = EXCLUDED.action_items,
      key_deadlines = EXCLUDED.key_deadlines,
      questions_to_ask = EXCLUDED.questions_to_ask,
      ai_confidence = EXCLUDED.ai_confidence,
      trusted_sources = EXCLUDED.trusted_sources,
      human_review = EXCLUDED.human_review,
      stage_outputs = EXCLUDED.stage_outputs,
      error_message = NULL,
      updated_at = now()`,
    [
      input.analysisRequestId,
      input.documentId,
      input.userId,
      input.model,
      status,
      input.result.summary,
      JSON.stringify(input.result.action_items),
      JSON.stringify(input.result.key_deadlines),
      JSON.stringify(input.result.questions_to_ask),
      JSON.stringify(input.result.ai_confidence),
      JSON.stringify(input.result.trusted_sources),
      JSON.stringify(input.result.human_review),
      JSON.stringify(input.result.stage_outputs),
    ],
  );
}

export async function failAnalysisResult(
  client: PoolClient,
  analysisRequestId: string,
  documentId: string,
  userId: string,
  model: string,
  errorMessage: string,
): Promise<void> {
  await client.query(
    `INSERT INTO document_analysis_results (
      analysis_request_id,
      document_id,
      user_id,
      model,
      status,
      error_message,
      updated_at
    )
    VALUES ($1, $2, $3, $4, 'failed', $5, now())
    ON CONFLICT (analysis_request_id)
    DO UPDATE SET
      document_id = EXCLUDED.document_id,
      user_id = EXCLUDED.user_id,
      model = EXCLUDED.model,
      status = 'failed',
      error_message = EXCLUDED.error_message,
      updated_at = now()`,
    [analysisRequestId, documentId, userId, model, errorMessage],
  );
}

export async function withAnalysisResultTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withTransaction(fn);
}
