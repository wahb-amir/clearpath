import { Router, Response } from "express";
import crypto from "crypto";
import path from "path";
import { supabaseAdmin } from "../lib/supabase";
import { AuthRequest, requireAuth } from "../middlewares/auth";

const router = Router();

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const SIGNED_URL_TTL_HOURS = 2;

const ALLOWED_TYPES = new Map<string, string>([
  ["application/pdf", ".pdf"],
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["text/plain", ".txt"],
]);

const DOC_STATUS = {
  PENDING_UPLOAD: "pending_upload",
  UPLOADED: "uploaded",
  VERIFIED: "verified",
  FAILED: "failed",
  STORAGE_MISSING: "storage_missing",
  EXPIRED: "expired",
} as const;

const SESSION_STATUS = {
  PENDING: "pending",
  SIGNED: "signed",
  CLIENT_UPLOADED: "client_uploaded",
  COMPLETED: "completed",
  FAILED: "failed",
  EXPIRED: "expired",
} as const;

function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName.trim());
  return base
    .replace(/[^\w.\-()+\s]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

function getExpectedExt(fileName: string, mimeType: string): string | null {
  const expectedExt = ALLOWED_TYPES.get(mimeType);
  if (!expectedExt) return null;

  const actualExt = path.extname(path.basename(fileName)).toLowerCase();
  if (!actualExt || actualExt !== expectedExt) return null;

  return expectedExt;
}

function isValidPositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  );
}

/**
 * POST /uploads/sign
 * Creates:
 * - documents row
 * - document_upload_sessions row
 * - signed upload URL
 */
router.post("/sign", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { fileName, fileSize, mimeType } = req.body ?? {};

    if (typeof fileName !== "string" || !fileName.trim()) {
      return res.status(400).json({
        success: false,
        message: "fileName required",
      });
    }

    if (!isValidPositiveInteger(fileSize)) {
      return res.status(400).json({
        success: false,
        message: "Valid fileSize required",
      });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "File too large",
      });
    }

    if (typeof mimeType !== "string" || !ALLOWED_TYPES.has(mimeType)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type",
      });
    }

    const expectedExt = getExpectedExt(fileName, mimeType);
    if (!expectedExt) {
      return res.status(400).json({
        success: false,
        message: "File extension does not match allowed type",
      });
    }

    const documentId = crypto.randomUUID();
    const uploadSessionId = crypto.randomUUID();
    const originalFileName = sanitizeFileName(fileName);

    // Keep the storage key predictable and safe.
    const storagePath = `users/${userId}/${documentId}${expectedExt}`;

    // 1) Create the canonical document record in Postgres first.
    const { error: docInsertError } = await supabaseAdmin
      .from("documents")
      .insert({
        id: documentId,
        user_id: userId,
        storage_path: storagePath,
        original_file_name: originalFileName,
        mime_type: mimeType,
        file_size: fileSize,

        // adjust these labels only if your enum values differ
        upload_status: DOC_STATUS.PENDING_UPLOAD,
        analysis_status: "pending",
        current_stage: "pending_upload",
        language: null,
        ocr_confidence: null,
        quality: null,
        worker_id: null,
      });

    if (docInsertError) {
      return res.status(500).json({
        success: false,
        message: "Failed to create document record",
      });
    }

    // 2) Create an upload session row.
    const signedExpiresAt = new Date(Date.now() + SIGNED_URL_TTL_HOURS * 60 * 60 * 1000);

    const { error: sessionInsertError } = await supabaseAdmin
      .from("document_upload_sessions")
      .insert({
        id: uploadSessionId,
        document_id: documentId,
        user_id: userId,
        storage_path: storagePath,
        status: SESSION_STATUS.PENDING,
        signed_at: new Date().toISOString(),
        signed_expires_at: signedExpiresAt.toISOString(),
      });

    if (sessionInsertError) {
      return res.status(500).json({
        success: false,
        message: "Failed to create upload session",
      });
    }

    // 3) Create signed upload URL.
    const { data, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUploadUrl(storagePath, {
        upsert: false,
      });

    if (error || !data?.token) {
      await supabaseAdmin
        .from("documents")
        .update({
          upload_status: DOC_STATUS.FAILED,
          last_error: error?.message ?? "Failed to create signed upload url",
        })
        .eq("id", documentId)
        .eq("user_id", userId);

      await supabaseAdmin
        .from("document_upload_sessions")
        .update({
          status: SESSION_STATUS.FAILED,
          error_message: error?.message ?? "Failed to create signed upload url",
        })
        .eq("id", uploadSessionId)
        .eq("user_id", userId);

      return res.status(500).json({
        success: false,
        message: error?.message ?? "Failed to create signed upload url",
      });
    }

    await supabaseAdmin
      .from("document_upload_sessions")
      .update({
        status: SESSION_STATUS.SIGNED,
      })
      .eq("id", uploadSessionId)
      .eq("user_id", userId);

    return res.json({
      success: true,
      documentId,
      uploadSessionId,
      path: storagePath,
      uploadToken: data.token,
      expiresInSeconds: SIGNED_URL_TTL_HOURS * 60 * 60,
    });
  } catch (error) {
    console.error("uploads/sign error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * POST /uploads/complete
 * Verifies the object exists in Storage and syncs DB state.
 */
router.post("/complete", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { documentId, uploadSessionId } = req.body ?? {};

    if (typeof documentId !== "string" || !documentId) {
      return res.status(400).json({
        success: false,
        message: "documentId required",
      });
    }

    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select(
        "id,user_id,storage_path,mime_type,file_size,upload_status,analysis_status,current_stage"
      )
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (docError || !doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    if (uploadSessionId) {
      const { data: session } = await supabaseAdmin
        .from("document_upload_sessions")
        .select("id,status")
        .eq("id", uploadSessionId)
        .eq("user_id", userId)
        .eq("document_id", documentId)
        .single();

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Upload session not found",
        });
      }
    }

    // Supabase Storage metadata check. info() returns size, content type, and timestamps.
    const { data: objectInfo, error: infoError } = await supabaseAdmin.storage
      .from("documents")
      .info(doc.storage_path);

    if (infoError || !objectInfo) {
      await supabaseAdmin
        .from("documents")
        .update({
          upload_status: DOC_STATUS.STORAGE_MISSING,
          last_error: "File missing from storage during completion check",
        })
        .eq("id", documentId)
        .eq("user_id", userId);

      if (uploadSessionId) {
        await supabaseAdmin
          .from("document_upload_sessions")
          .update({
            status: SESSION_STATUS.FAILED,
            error_message: "File missing from storage during completion check",
          })
          .eq("id", uploadSessionId)
          .eq("user_id", userId);
      }

      return res.status(409).json({
        success: false,
        message: "File not found in storage",
      });
    }

    const actualSize =
      typeof (objectInfo as any).size === "number"
        ? (objectInfo as any).size
        : typeof (objectInfo as any).fileSize === "number"
          ? (objectInfo as any).fileSize
          : null;

    const actualContentType =
      (objectInfo as any).contentType ??
      (objectInfo as any).content_type ??
      (objectInfo as any).mimetype ??
      (objectInfo as any).mimeType ??
      null;

    if (actualSize !== null && actualSize !== doc.file_size) {
      await supabaseAdmin
        .from("documents")
        .update({
          upload_status: DOC_STATUS.FAILED,
          last_error: `Size mismatch: expected ${doc.file_size}, got ${actualSize}`,
        })
        .eq("id", documentId)
        .eq("user_id", userId);

      if (uploadSessionId) {
        await supabaseAdmin
          .from("document_upload_sessions")
          .update({
            status: SESSION_STATUS.FAILED,
            error_message: `Size mismatch: expected ${doc.file_size}, got ${actualSize}`,
          })
          .eq("id", uploadSessionId)
          .eq("user_id", userId);
      }

      return res.status(409).json({
        success: false,
        message: "Uploaded file size mismatch",
      });
    }

    if (actualContentType && actualContentType !== doc.mime_type) {
      await supabaseAdmin
        .from("documents")
        .update({
          upload_status: DOC_STATUS.FAILED,
          last_error: `Content type mismatch: expected ${doc.mime_type}, got ${actualContentType}`,
        })
        .eq("id", documentId)
        .eq("user_id", userId);

      if (uploadSessionId) {
        await supabaseAdmin
          .from("document_upload_sessions")
          .update({
            status: SESSION_STATUS.FAILED,
            error_message: `Content type mismatch: expected ${doc.mime_type}, got ${actualContentType}`,
          })
          .eq("id", uploadSessionId)
          .eq("user_id", userId);
      }

      return res.status(409).json({
        success: false,
        message: "Uploaded file type mismatch",
      });
    }

    const now = new Date().toISOString();

    await supabaseAdmin
      .from("documents")
      .update({
        upload_status: DOC_STATUS.UPLOADED,
        current_stage: "uploaded",
        uploaded_at: now,
        verified_at: now,
        last_error: null,
      })
      .eq("id", documentId)
      .eq("user_id", userId);

    if (uploadSessionId) {
      await supabaseAdmin
        .from("document_upload_sessions")
        .update({
          status: SESSION_STATUS.COMPLETED,
          completed_at: now,
          uploaded_at: now,
          error_message: null,
        })
        .eq("id", uploadSessionId)
        .eq("user_id", userId);
    }

    return res.json({
      success: true,
      documentId,
      storagePath: doc.storage_path,
      verified: true,
      nextStage: "ready_for_processing",
    });
  } catch (error) {
    console.error("uploads/complete error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * POST /uploads/fail
 * Optional: lets the client report an upload failure.
 */
router.post("/fail", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { documentId, uploadSessionId, reason } = req.body ?? {};

    if (typeof documentId !== "string" || !documentId) {
      return res.status(400).json({
        success: false,
        message: "documentId required",
      });
    }

    await supabaseAdmin
      .from("documents")
      .update({
        upload_status: DOC_STATUS.FAILED,
        last_error: typeof reason === "string" ? reason.slice(0, 500) : "Upload failed",
      })
      .eq("id", documentId)
      .eq("user_id", userId);

    if (typeof uploadSessionId === "string" && uploadSessionId) {
      await supabaseAdmin
        .from("document_upload_sessions")
        .update({
          status: SESSION_STATUS.FAILED,
          error_message: typeof reason === "string" ? reason.slice(0, 500) : "Upload failed",
        })
        .eq("id", uploadSessionId)
        .eq("user_id", userId);
    }

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error("uploads/fail error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;