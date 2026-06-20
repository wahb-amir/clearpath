// src/routes/auth.ts
import { Router, Request, Response } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { supabase } from "../lib/supabase";
import { signAccessToken, generateRefreshToken, getJwks } from "../utils/jwt";
import {
  createSession,
  refreshSession,
  revokeSession,
} from "../services/sessionService";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { rateLimiter, refreshRateLimiter } from "../middlewares/rateLimiter";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const isProd = process.env.NODE_ENV !== "development";

const authCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/",
  ...(isProd ? { domain: ".wahb.space" } : {}),
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const clearCookieOptions = {
  path: "/",
  ...(isProd ? { domain: ".wahb.space" } : {}),
};

const setAuthCookies = (
  res: Response,
  params: {
    accessToken: string;
    refreshToken: string;
    sid: string;
  },
) => {
  res.cookie("accessToken", params.accessToken, authCookieOptions);
  res.cookie("refreshToken", params.refreshToken, authCookieOptions);
  res.cookie("sid", params.sid, authCookieOptions);
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie("accessToken", clearCookieOptions);
  res.clearCookie("refreshToken", clearCookieOptions);
  res.clearCookie("sid", clearCookieOptions);
};

router.post("/register", rateLimiter, async (req: Request, res: Response) => {
  try {
    const { fullName, email, password } = registerSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const passwordHash = await argon2.hash(password);

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        email: normalizedEmail,
        full_name: fullName,
        password_hash: passwordHash,
      })
      .select("id, full_name, email")
      .single();

    if (insertError || !newUser) {
      console.log(insertError);
      res.status(500).json({ error: "Failed to complete registration" });
      return;
    }

    const refreshToken = generateRefreshToken();
    const deviceMeta =
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : "Unknown Device";
    const ip = req.ip || req.socket.remoteAddress || "Unknown IP";

    const { sid } = await createSession(
      newUser.id,
      refreshToken,
      deviceMeta,
      ip,
    );
    const accessToken = signAccessToken(newUser.id, sid);

    setAuthCookies(res, { accessToken, refreshToken, sid });

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        fullName: newUser.full_name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(400).json({ error: "Bad Request" });
  }
});

router.post("/login", rateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const { data: user, error } = await supabase
      .from("users")
      .select("id, full_name, email, password_hash")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (error || !user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const refreshToken = generateRefreshToken();
    const deviceMeta =
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : "Unknown Device";
    const ip = req.ip || req.socket.remoteAddress || "Unknown IP";

    const { sid } = await createSession(user.id, refreshToken, deviceMeta, ip);
    const accessToken = signAccessToken(user.id, sid);

    setAuthCookies(res, { accessToken, refreshToken, sid });

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(400).json({ error: "Bad Request" });
  }
});

router.post(
  "/refresh",
  refreshRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const sid = req.cookies?.sid;
      const refreshToken = req.cookies?.refreshToken;
      if (!sid || !refreshToken) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const newRefreshToken = generateRefreshToken();
      const { newSid, userId } = await refreshSession(
        sid,
        refreshToken,
        newRefreshToken,
      );
      const accessToken = signAccessToken(userId, newSid);

      setAuthCookies(res, {
        accessToken,
        refreshToken: newRefreshToken,
        sid: newSid,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Refresh error:", error?.message || error);
      clearAuthCookies(res);
      res.status(401).json({ error: "Unauthorized or token reused" });
    }
  },
);

router.post("/logout", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sid = req.user?.sid;

    if (sid) {
      await revokeSession(sid);
    }

    clearAuthCookies(res);
    res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/.well-known/jwks.json", (_req: Request, res: Response) => {
  res.json(getJwks());
});

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select(
        "full_name, email, created_at, documents_analyzed_count, deadlines_tracked_count",
      )
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({
        error: "Failed to fetch user",
      });
    }

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json({
      message: "You are authenticated!",
      user: {
        full_name: user.full_name,
        email: user.email,
        created_at: user.created_at,
        documentsAnalyzedCount: user.documents_analyzed_count ?? 0,
        deadlinesTrackedCount: user.deadlines_tracked_count ?? 0,
      },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;