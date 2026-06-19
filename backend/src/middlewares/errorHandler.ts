import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../types/errors";

/**
 * Global Express error handler. Mount this LAST in src/index.ts
 * (after all routes) with:
 *   app.use(errorHandler);
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      issues: err.issues,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details ?? undefined,
    });
    return;
  }

  // Unexpected error - do not leak internals
  console.error("[unhandled error]", err);
  res.status(500).json({
    error: "An unexpected error occurred",
    code: "INTERNAL_SERVER_ERROR",
  });
}
