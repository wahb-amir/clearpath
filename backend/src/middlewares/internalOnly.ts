import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

/**
 * Simple shared-secret guard for /internal/* routes.
 * Add INTERNAL_API_KEY to your env schema and .env file.
 *
 * In production, prefer placing /internal/* behind a network boundary
 * (VPC-only, not internet-exposed) in addition to this check.
 */
export function internalOnly(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = req.header("x-internal-api-key");
  if (!env.INTERNAL_API_KEY || key !== env.INTERNAL_API_KEY) {
    res.status(403).json({ error: "Forbidden", code: "INTERNAL_ONLY" });
    return;
  }
  next();
}
