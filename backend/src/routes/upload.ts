// routes/uploads.ts

import { Router, Response } from "express";
import crypto from "crypto";
import path from "path";
import { supabaseAdmin } from "../lib/supabase";
import { AuthRequest, requireAuth } from "../middlewares/auth";

const router = Router();

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_MIME_TYPES = new Map<string, string>([
  ["application/pdf", ".pdf"],
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["text/plain", ".txt"],
]);

function sanitizeBaseName(fileName: string): string {
  const base = path.basename(fileName); // strips any path parts
  return base
    .replace(/[^\w.\-()+\s]/g, "_") // remove weird chars
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

function getSafeExtension(fileName: string, mimeType: string): string | null {
  const expectedExt = ALLOWED_MIME_TYPES.get(mimeType);
  if (!expectedExt) return null;

  const actualExt = path.extname(fileName).toLowerCase();

  // Require a known extension and make sure it matches the MIME type.
  if (!actualExt || actualExt !== expectedExt) return null;

  return expectedExt;
}

router.post("/sign", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { fileName, fileSize, mimeType } = req.body ?? {};

    if (typeof fileName !== "string" || !fileName.trim()) {
      return res.status(400).json({
        success: false,
        message: "fileName required",
      });
    }

    if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid fileSize required",
      });
    }

    if (fileSize > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: "File too large",
      });
    }

    if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type",
      });
    }

    const safeExt = getSafeExtension(fileName, mimeType);
    if (!safeExt) {
      return res.status(400).json({
        success: false,
        message: "File extension does not match allowed type",
      });
    }

    const fileId = crypto.randomUUID();
    const sanitizedName = sanitizeBaseName(fileName);
    const objectPath = `users/${userId}/${fileId}${safeExt}`;

    // 1) Create a pending DB record first
    const { data: uploadRow, error: insertError } = await supabaseAdmin
      .from("document_uploads")
      .insert({
        id: fileId,
        user_id: userId,
        bucket: "documents",
        path: objectPath,
        original_name: sanitizedName,
        expected_mime_type: mimeType,
        expected_size: fileSize,
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      return res.status(500).json({
        success: false,
        message: "Failed to create upload record",
      });
    }

    // 2) Create signed upload URL
    const { data, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUploadUrl(objectPath, {
        upsert: false,
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    return res.json({
      success: true,
      uploadId: uploadRow.id,
      uploadToken: data.token,
      path: objectPath,
      expiresInSeconds: 7200,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;