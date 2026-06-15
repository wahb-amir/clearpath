// routes/uploads.ts

import { Router, Response } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { AuthRequest, requireAuth } from "../middlewares/auth";
const router = Router();

router.post("/sign", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { fileName, fileSize, mimeType } = req.body;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: "fileName required",
      });
    }

    // Validate file size
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    if (fileSize > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: "File too large",
      });
    }

    // Validate mime types
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
    ];

    if (!allowedTypes.includes(mimeType)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type",
      });
    }

    // TypeScript is now perfectly happy because it knows req is an AuthRequest!
    const userId = req.user?.userId;

    const fileId = crypto.randomUUID();

    const path = `users/${userId}/${fileId}-${fileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUploadUrl(path, {
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
      uploadToken: data.token,
      path,
      fileId,
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
