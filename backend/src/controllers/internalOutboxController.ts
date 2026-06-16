import type { Request, Response, NextFunction } from 'express';
import { outboxDispatcher } from '../outbox/dispatcher';

/**
 * POST /internal/outbox/dispatch
 *
 * Manual/admin trigger for the outbox dispatcher - useful for:
 *  - ops runbooks ("force a sweep now")
 *  - cron-based dispatch instead of (or in addition to) the
 *    long-lived OutboxDispatcher process
 *
 * Protect this route with internal-only auth (e.g. a separate
 * INTERNAL_API_KEY middleware) - do not expose to end users.
 */
export async function dispatchOutboxController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await outboxDispatcher.dispatchPending();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
