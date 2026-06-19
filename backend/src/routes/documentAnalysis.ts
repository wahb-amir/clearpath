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
} from "../controllers/analysisHistoryController";

const router = Router();

// POST /analysis/documents/:id/analyze
router.post("/documents/:id/analyze", requireAuth, analyzeDocumentController);

// GET /analysis/documents/:id/events  (SSE)
router.get(
  "/documents/:id/events",
  requireAuth,
  streamDocumentEventsController,
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

export default router;
