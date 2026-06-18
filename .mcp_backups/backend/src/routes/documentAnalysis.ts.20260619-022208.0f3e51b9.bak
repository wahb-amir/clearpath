import { Router } from 'express';
import { requireAuth } from '../middlewares/auth'; // existing middleware
import { internalOnly } from '../middlewares/internalOnly';
import { analyzeDocumentController } from '../controllers/analyzeController';
import { streamDocumentEventsController } from '../controllers/sseController';
import { dispatchOutboxController } from '../controllers/internalOutboxController';

const router = Router();

// POST /documents/:id/analyze
router.post('/documents/:id/analyze', requireAuth, analyzeDocumentController);

// GET /documents/:id/events  (SSE)
router.get('/documents/:id/events', requireAuth, streamDocumentEventsController);

// POST /internal/outbox/dispatch
router.post('/internal/outbox/dispatch', internalOnly, dispatchOutboxController);

export default router;
