import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env";
import authRoutes from "./routes/auth";
import { supabase } from "./lib/supabase";
import documentAnalysisRoutes from "./routes/documentAnalysis";
import { errorHandler } from "./middlewares/errorHandler";
import uploadRoutes from "./routes/upload";
const app = express();

// Trust proxy is essential when behind Next.js or a load balancer
// so that req.ip gets the correct client IP instead of the proxy's IP
app.set("trust proxy", 1);

// Request logging
app.use(morgan("dev"));

app.use(
  cors({
    // 1. Dynamic origin fallback ensuring a valid URL is always matched
    origin: (origin, callback) => {
      const allowedOrigin = env.FRONTEND_URL || "https://clearpath.buttnetworks.com";

      // Allow requests with no origin (like mobile apps, curl, or Postman)
      // or if the incoming browser origin matches your configured frontend URL
      if (!origin || origin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    // 2. Fixes legacy browsers/environments choking on pre-flight checks
    optionsSuccessStatus: 200,
  }),
);

app.use(express.json());
app.use(cookieParser());

/**
 * Verify Supabase Connectivity on Startup
 * Runs a lightweight query to ensure the backend can talk to your Postgres instance.
 * On a HF Space, the Supabase env vars are baked in as secrets so this
 * should always succeed; if it fails, log a warning rather than killing
 * the process so the Gradio shell can stay up and surface the error.
 */
async function verifyDatabaseConnection() {
  try {
    // Select a single column with a limit of 1 to minimize data transfer overhead
    const { error } = await supabase.from("users").select("id").limit(1);

    if (error) {
      // PGRST116 means "JSON object requested, but 0 rows returned".
      // If the table is empty, this error code confirms the table exists and connection is valid.
      if (error.code !== "PGRST116") throw error;
    }

    console.log(
      "✅ PostgreSQL Connection verified successfully via Supabase API.",
    );
  } catch (err: any) {
    console.warn("⚠️ Supabase check failed (continuing in degraded mode):");
    console.warn(err?.message || err);
  }
}

// Fire the connection check (non-fatal in HF Space contexts).
verifyDatabaseConnection();

// --- Routes ---
app.use("/auth", authRoutes);
app.use("/uploads", uploadRoutes);

// Mount all document analysis routes under the '/analysis' prefix
app.use("/analysis", documentAnalysisRoutes);
app.get("/api/health", (req, res) => {
  console.log("GET /api/health");
  res.json({ status: "OK", message: "ClearPath Backend is running" });
});

// global error handler - must be last middleware
app.use(errorHandler);

const PORT = env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
