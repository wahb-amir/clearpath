import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { internalOnly } from "../middlewares/internalOnly";
import { analyzeDocumentController } from "../controllers/analyzeController";
import { streamDocumentEventsController } from "../controllers/sseController";
import { dispatchOutboxController } from "../controllers/internalOutboxController";
import {
  getAnalysisHistoryController,
  getAnalysisRunDetailController,
  getUserRunningAnalysisController,
  toggleActionItemController,
  getSavedDocumentsController,
  toggleSaveDocumentController,
} from "../controllers/analysisHistoryController";
import { confirmExtractionController } from "../controllers/confirmExtractionController";
import { saveExtractionDraftController } from "../controllers/saveExtractionDraftController";

const router = Router();

// POST /analysis/documents/:id/analyze
router.post("/documents/:id/analyze", requireAuth, analyzeDocumentController);

// GET /analysis/documents/:id/events  (SSE)
router.get(
  "/documents/:id/events",
  requireAuth,
  streamDocumentEventsController,
);

// POST /analysis/documents/:id/confirm-extraction
router.post(
  "/documents/:id/confirm-extraction",
  requireAuth,
  confirmExtractionController,
);

// PATCH /analysis/documents/:id/extracted-content
router.patch(
  "/documents/:id/extracted-content",
  requireAuth,
  saveExtractionDraftController,
);

// GET /analysis/documents/:id/extracted-content  — fetch stored extracted content for review
router.get(
  "/documents/:id/extracted-content",
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { pgPool } = await import("../db/pool");
      const result = await pgPool.query(
        `SELECT extracted_content, analysis_status, storage_path, mime_type, original_file_name
           FROM documents
          WHERE id = $1 AND user_id = $2`,
        [req.params.id, userId],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },
);

// POST /analysis/internal/outbox/dispatch
router.post(
  "/internal/outbox/dispatch",
  internalOnly,
  dispatchOutboxController,
);

// GET /analysis/history
router.get("/history", requireAuth, getAnalysisHistoryController);

// GET /analysis/runs/:documentId  — single run detail with events
router.get("/runs/:documentId", requireAuth, getAnalysisRunDetailController);

// GET /analysis/running-check — check if user has in-flight analysis
router.get("/running-check", requireAuth, getUserRunningAnalysisController);

// GET /analysis/saved — list all bookmarked documents for the current user
router.get("/saved", requireAuth, getSavedDocumentsController);

// POST /analysis/documents/:id/toggle-save — toggle bookmark status
router.post(
  "/documents/:id/toggle-save",
  requireAuth,
  toggleSaveDocumentController,
);
// Patch
router.patch(
  "/:analysisRequestId/action-items/:index/toggle",
  requireAuth,
  toggleActionItemController,
);

export default router;
