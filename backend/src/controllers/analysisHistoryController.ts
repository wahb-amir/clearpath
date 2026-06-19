import type { Request, Response, NextFunction } from "express";
import { pgPool } from "../db/pool";

interface AuthenticatedRequest extends Request {
  user?: {
    userId?: string;
    [key: string]: unknown;
  };
}

const IN_FLIGHT_ANALYSIS_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "EXTRACTING",
  "OCRING",
  "CLEANING",
  "STRUCTURING",
  "CHUNKING",
  "EMBEDDING",
  "SUMMARIZING",
  "PREPROCESSING_COMPLETED",
  "AI_QUEUED",
  "AI_PROCESSING",
  "AI_COMPLETED",
];

/**
 * GET /analysis/history
 *
 * Query params:
 *   page     (number, default 1)
 *   pageSize (number, default 20, max 100)
 *   status   ("completed" | "review_required" | "failed" | "running" | "all", default "all")
 *
 * Returns:
 *   { items: AnalysisHistoryItem[], total: number, page: number, pageSize: number, totalPages: number }
 */
export async function getAnalysisHistoryController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20),
    );
    const statusFilter = String(req.query.status ?? "all");
    const offset = (page - 1) * pageSize;

    let statusClause: string;
    if (statusFilter === "running") {
      // Running = in-flight documents without a terminal result
      statusClause = `AND d.analysis_status IN (${IN_FLIGHT_ANALYSIS_STATUSES.map((s) => `'${s}'`).join(", ")})`;
    } else if (statusFilter === "completed") {
      statusClause = `AND dar.status = 'completed'`;
    } else if (statusFilter === "review_required") {
      statusClause = `AND dar.status = 'review_required'`;
    } else if (statusFilter === "failed") {
      statusClause = `AND dar.status = 'failed'`;
    } else {
      // "all" — include everything: terminal results + in-flight
      statusClause = "";
    }

    // For "running", we query a different shape (no dar result yet, or pending)
    // We use a UNION approach: in-flight docs + terminal results
    let countSql: string;
    let rowsSql: string;
    let queryParams: unknown[];

    if (statusFilter === "running") {
      countSql = `
        SELECT COUNT(*) AS total
        FROM documents d
        LEFT JOIN document_analysis_requests dar_req
          ON dar_req.document_id = d.id
          AND dar_req.status IN ('PENDING','QUEUED','PROCESSING')
        WHERE d.user_id = $1
          AND d.analysis_status IN (${IN_FLIGHT_ANALYSIS_STATUSES.map((s) => `'${s}'`).join(", ")})
      `;

      rowsSql = `
        SELECT
          gen_random_uuid()           AS id,
          dar_req.id                  AS analysis_request_id,
          d.id                        AS document_id,
          'running'                   AS status,
          NULL                        AS summary,
          '[]'::jsonb                 AS action_items,
          '[]'::jsonb                 AS key_deadlines,
          '[]'::jsonb                 AS questions_to_ask,
          NULL                        AS ai_confidence,
          '[]'::jsonb                 AS trusted_sources,
          NULL                        AS human_review,
          NULL                        AS model,
          d.created_at,
          d.updated_at,
          d.original_file_name,
          d.mime_type,
          d.file_size,
          d.language,
          d.analysis_status           AS doc_analysis_status,
          d.current_stage
        FROM documents d
        LEFT JOIN document_analysis_requests dar_req
          ON dar_req.document_id = d.id
          AND dar_req.status IN ('PENDING','QUEUED','PROCESSING')
        WHERE d.user_id = $1
          AND d.analysis_status IN (${IN_FLIGHT_ANALYSIS_STATUSES.map((s) => `'${s}'`).join(", ")})
        ORDER BY d.updated_at DESC
        LIMIT $2 OFFSET $3
      `;
      queryParams = [userId, pageSize, offset];
    } else if (statusFilter === "all") {
      // Combine terminal results + in-flight documents
      countSql = `
        SELECT (
          (SELECT COUNT(*) FROM document_analysis_results dar
           WHERE dar.user_id = $1 AND dar.status IN ('completed','review_required','failed'))
          +
          (SELECT COUNT(*) FROM documents d
           WHERE d.user_id = $1 AND d.analysis_status IN (${IN_FLIGHT_ANALYSIS_STATUSES.map((s) => `'${s}'`).join(", ")}))
        ) AS total
      `;

      rowsSql = `
        SELECT * FROM (
          SELECT
            dar.id,
            dar.analysis_request_id,
            dar.document_id,
            dar.status,
            dar.summary,
            dar.action_items,
            dar.key_deadlines,
            dar.questions_to_ask,
            dar.ai_confidence,
            dar.trusted_sources,
            dar.human_review,
            dar.model,
            dar.created_at,
            dar.updated_at,
            d.original_file_name,
            d.mime_type,
            d.file_size,
            d.language,
            d.analysis_status AS doc_analysis_status,
            d.current_stage
          FROM document_analysis_results dar
          LEFT JOIN documents d ON d.id = dar.document_id
          WHERE dar.user_id = $1
            AND dar.status IN ('completed','review_required','failed')

          UNION ALL

          SELECT
            gen_random_uuid()           AS id,
            dar_req.id                  AS analysis_request_id,
            d.id                        AS document_id,
            'running'                   AS status,
            NULL                        AS summary,
            '[]'::jsonb                 AS action_items,
            '[]'::jsonb                 AS key_deadlines,
            '[]'::jsonb                 AS questions_to_ask,
            NULL                        AS ai_confidence,
            '[]'::jsonb                 AS trusted_sources,
            NULL                        AS human_review,
            NULL                        AS model,
            d.created_at,
            d.updated_at,
            d.original_file_name,
            d.mime_type,
            d.file_size,
            d.language,
            d.analysis_status           AS doc_analysis_status,
            d.current_stage
          FROM documents d
          LEFT JOIN document_analysis_requests dar_req
            ON dar_req.document_id = d.id
            AND dar_req.status IN ('PENDING','QUEUED','PROCESSING')
          WHERE d.user_id = $1
            AND d.analysis_status IN (${IN_FLIGHT_ANALYSIS_STATUSES.map((s) => `'${s}'`).join(", ")})
        ) combined
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3
      `;
      queryParams = [userId, pageSize, offset];
    } else {
      countSql = `
        SELECT COUNT(*) AS total
        FROM document_analysis_results dar
        WHERE dar.user_id = $1 ${statusClause}
      `;

      rowsSql = `
        SELECT
          dar.id,
          dar.analysis_request_id,
          dar.document_id,
          dar.status,
          dar.summary,
          dar.action_items,
          dar.key_deadlines,
          dar.questions_to_ask,
          dar.ai_confidence,
          dar.trusted_sources,
          dar.human_review,
          dar.model,
          dar.created_at,
          dar.updated_at,
          d.original_file_name,
          d.mime_type,
          d.file_size,
          d.language,
          d.analysis_status AS doc_analysis_status,
          d.current_stage
        FROM document_analysis_results dar
        LEFT JOIN documents d ON d.id = dar.document_id
        WHERE dar.user_id = $1 ${statusClause}
        ORDER BY dar.updated_at DESC
        LIMIT $2 OFFSET $3
      `;
      queryParams = [userId, pageSize, offset];
    }

    const countResult = await pgPool.query<{ total: string }>(countSql, [
      userId,
    ]);
    const total = parseInt(countResult.rows[0]?.total ?? "0", 10);

    const rowsResult = await pgPool.query(rowsSql, queryParams);

    const items = rowsResult.rows.map((row) => ({
      id: row.id,
      analysisRequestId: row.analysis_request_id,
      documentId: row.document_id,
      status: row.status,
      summary: row.summary ?? null,
      actionItems: row.action_items ?? [],
      keyDeadlines: row.key_deadlines ?? [],
      questionsToAsk: row.questions_to_ask ?? [],
      aiConfidence: row.ai_confidence ?? null,
      trustedSources: row.trusted_sources ?? [],
      humanReview: row.human_review ?? null,
      model: row.model ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      docAnalysisStatus: row.doc_analysis_status ?? null,
      currentStage: row.current_stage ?? null,
      document: {
        fileName: row.original_file_name ?? null,
        mimeType: row.mime_type ?? null,
        fileSizeBytes: row.file_size ?? null,
        language: row.language ?? null,
      },
    }));

    res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /analysis/runs/:documentId
 *
 * Returns details of a single analysis run including pipeline events.
 */
export async function getAnalysisRunDetailController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { documentId } = req.params;
    if (!documentId) {
      res.status(400).json({ error: "documentId is required" });
      return;
    }

    // Fetch document + latest analysis result
    const docResult = await pgPool.query(
      `SELECT
        d.id, d.original_file_name, d.mime_type, d.file_size, d.language,
        d.analysis_status, d.current_stage, d.created_at, d.updated_at,
        dar.id AS result_id,
        dar.status AS result_status,
        dar.summary,
        dar.action_items,
        dar.key_deadlines,
        dar.questions_to_ask,
        dar.ai_confidence,
        dar.trusted_sources,
        dar.human_review,
        dar.model,
        dar.error_message,
        dar.analysis_request_id
      FROM documents d
      LEFT JOIN document_analysis_results dar ON dar.document_id = d.id
      WHERE d.id = $1 AND d.user_id = $2
      ORDER BY dar.created_at DESC
      LIMIT 1`,
      [documentId, userId],
    );

    if (docResult.rowCount === 0) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    const row = docResult.rows[0];

    // Fetch pipeline events
    const eventsResult = await pgPool.query(
      `SELECT id, event_type, stage, message, progress, payload, created_at
       FROM document_pipeline_events
       WHERE document_id = $1 AND user_id = $2
       ORDER BY id ASC
       LIMIT 500`,
      [documentId, userId],
    );

    const events = eventsResult.rows.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      stage: e.stage,
      message: e.message,
      progress: e.progress,
      payload: e.payload,
      createdAt: e.created_at,
    }));

    // Determine overall status
    let status = row.result_status ?? "running";
    if (!row.result_id) {
      status = "running";
    }

    res.json({
      documentId: row.id,
      fileName: row.original_file_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size,
      language: row.language,
      docAnalysisStatus: row.analysis_status,
      currentStage: row.current_stage,
      status,
      summary: row.summary ?? null,
      actionItems: row.action_items ?? [],
      keyDeadlines: row.key_deadlines ?? [],
      questionsToAsk: row.questions_to_ask ?? [],
      aiConfidence: row.ai_confidence ?? null,
      trustedSources: row.trusted_sources ?? [],
      humanReview: row.human_review ?? null,
      model: row.model ?? null,
      errorMessage: row.error_message ?? null,
      analysisRequestId: row.analysis_request_id ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      events,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /analysis/running-check
 *
 * Returns whether the current user has an in-flight analysis.
 */
export async function getUserRunningAnalysisController(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await pgPool.query(
      `SELECT id, original_file_name, analysis_status
       FROM documents
       WHERE user_id = $1
         AND analysis_status IN (${IN_FLIGHT_ANALYSIS_STATUSES.map((s) => `'${s}'`).join(", ")})
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId],
    );

    if (result.rowCount === 0) {
      res.json({ running: false, document: null });
      return;
    }

    const doc = result.rows[0];
    res.json({
      running: true,
      document: {
        id: doc.id,
        fileName: doc.original_file_name,
        analysisStatus: doc.analysis_status,
      },
    });
  } catch (err) {
    next(err);
  }
}
