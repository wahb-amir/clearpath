import type { Request, Response, NextFunction } from 'express';
import { pgPool } from '../db/pool';

interface AuthenticatedRequest extends Request {
  user?: {
    userId?: string;
    [key: string]: unknown;
  };
}

/**
 * GET /analysis/history
 *
 * Query params:
 *   page     (number, default 1)
 *   pageSize (number, default 20, max 100)
 *   status   ("completed" | "review_required" | "failed" | "all", default "all")
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
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20),
    );
    const statusFilter = String(req.query.status ?? 'all');
    const offset = (page - 1) * pageSize;

    const allowedStatuses = ['completed', 'review_required', 'failed'];
    const statusClause =
      statusFilter !== 'all' && allowedStatuses.includes(statusFilter)
        ? `AND dar.status = '${statusFilter}'`
        : `AND dar.status IN ('completed', 'review_required', 'failed')`;

    const countResult = await pgPool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
         FROM document_analysis_results dar
        WHERE dar.user_id = $1
          ${statusClause}`,
      [userId],
    );

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    const rowsResult = await pgPool.query(
      `SELECT
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
           d.language
         FROM document_analysis_results dar
         LEFT JOIN documents d ON d.id = dar.document_id
        WHERE dar.user_id = $1
          ${statusClause}
        ORDER BY dar.updated_at DESC
        LIMIT $2
        OFFSET $3`,
      [userId, pageSize, offset],
    );

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
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    next(err);
  }
}
