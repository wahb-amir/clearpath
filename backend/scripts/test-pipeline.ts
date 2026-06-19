/**
 * scripts/test-pipeline.ts
 * --------------------------------------------------------------------------
 * End-to-end test of the document analysis pipeline:
 *   1. Generate a mock .txt file with realistic content (dates, emails,
 *      phone numbers, headings) so extraction/structuring/facts all have
 *      something meaningful to find.
 *   2. POST /uploads/sign  -> get documentId + signed upload token
 *   3. Upload the mock file directly to Supabase Storage using the
 *      signed token (via @supabase/supabase-js's uploadToSignedUrl)
 *   4. POST /uploads/complete -> mark upload as UPLOADED
 *   5. POST /documents/:id/analyze -> trigger the pipeline
 *   6. Connect to GET /documents/:id/events (SSE) and log every event
 *      as it streams in, until 'analysis_completed' or 'failed'
 *   7. Print a final summary: full event timeline + the processing
 *      summary payload from the 'analysis_completed' event
 *
 * AUTH: this script does NOT log in for you. Grab a fresh `accessToken`
 * cookie value from your browser (after logging in via your real auth
 * flow) and paste it into ACCESS_TOKEN below, or pass it as an env var:
 *
 *   ACCESS_TOKEN=eyJ... pnpm run test:pipeline
 *
 * Run via:
 *   pnpm run test:pipeline
 */

import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3001";
const ACCESS_TOKEN =
  process.env.ACCESS_TOKEN ??
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleS0xIn0.eyJzdWIiOiJlZWZhZGI5Ny02NjUwLTQ2ZGUtODRlOC01ODczYzdjZmQ3MTkiLCJzaWQiOiIzNDRiNTAwZi1jZjNiLTQwYTktOGI4OS04YTM3OTRhY2M4MWYiLCJpYXQiOjE3ODE2NDg5MDYsImV4cCI6MTc4MTY0OTgwNn0.usEh1eFs5CZpHwxThZ10115FjC7Gchrl-JTL6oIpZ6i8R7Q3vVZvyNKiD76V-3yzuZ-R174NZOIJOD2XMjM1GJhN5f9BEd0MHirM22avF2qPOA3zTR72jfzRu6BlUS8XzuTf_kkmqAAk62OS3vhq3NqxLgUPw2MDjXPuwSPZIkxltGCt6W7jTGQiLCr2uuaZ40LlbCii9a0WjoxqIZC39DvaF7mqEnIF6eqBu482ShwCXY6W_FZ--2JKwB-uviyFkzA65ulbh9B0eBN_cyiTgLzQSN8F86QjYtu7xLU0Kd2P4MXQuIzoXTfQSoyWnRnjmTUHI3Q0kdgm4dTNW83MUA";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://hjwhxqrgnfgvxjonlkpp.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_6FRq83gzHBSbIvAeStecDQ_DkUDCwtq";

const SSE_TIMEOUT_MS = 5 * 60 * 1000; // give up waiting for completion after 5 min

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in env.",
  );
  process.exit(1);
}

if (ACCESS_TOKEN === "<PASTE_YOUR_ACCESS_TOKEN_COOKIE_HERE>") {
  console.error(
    "❌ Set ACCESS_TOKEN env var (or edit the script) with a real accessToken cookie value.\n" +
      "   Example: ACCESS_TOKEN=eyJ... pnpm run test:pipeline",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────────────────────────────────────
// Small logging helpers
// ─────────────────────────────────────────────────────────────────────────

const startTime = Date.now();
function elapsed(): string {
  return `+${((Date.now() - startTime) / 1000).toFixed(2)}s`;
}

function log(label: string, ...args: unknown[]): void {
  console.log(`[${elapsed()}] [${label}]`, ...args);
}

function logError(label: string, ...args: unknown[]): void {
  console.error(`[${elapsed()}] [${label}] ❌`, ...args);
}

function section(title: string): void {
  console.log("\n" + "─".repeat(70));
  console.log(title);
  console.log("─".repeat(70));
}

// ─────────────────────────────────────────────────────────────────────────
// Mock file generation
// ─────────────────────────────────────────────────────────────────────────

function generateMockFileContent(): string {
  return `STUDENT MARKS SHEET

Semester: Fall 2026
Department: Computer Science

Instructor Contact
Name: Dr. Sarah Ahmed
Email: sarah.ahmed@university.edu.pk
Phone: +92 300 1234567

Course Overview

This document summarizes the marks obtained by students in the
Database Systems course (CS-301) during the Fall 2026 semester.
Grades were finalized on 2026-06-10 and must be submitted to the
registrar's office before the deadline on June 20, 2026.

Grading Breakdown

- Midterm Exam: 30%
- Final Exam: 40%
- Assignments: 20%
- Class Participation: 10%

Results

1. Ali Raza - Roll No: CS-2021-045 - Total Marks: 87 - Grade: A
2. Fatima Khan - Roll No: CS-2021-062 - Total Marks: 91 - Grade: A+
3. Bilal Hussain - Roll No: CS-2021-019 - Total Marks: 74 - Grade: B+

Reference ID: DOC-MARKS-2026-FALL-301

Notes

Any disputes regarding grades must be raised within 7 days of
publication. Contact the department office at registrar@university.edu.pk
or visit the office between 9 AM and 5 PM, Monday through Friday.

CONFIDENTIAL - For internal university use only.

Page 1
`;
}

// ─────────────────────────────────────────────────────────────────────────
// HTTP helper - forwards the accessToken as a Cookie header
// ─────────────────────────────────────────────────────────────────────────

async function apiRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `accessToken=${ACCESS_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: T;
  try {
    json = (await res.json()) as T;
  } catch {
    json = {} as T;
  }

  return { status: res.status, json };
}

// ─────────────────────────────────────────────────────────────────────────
// Step 1: sign
// ─────────────────────────────────────────────────────────────────────────

interface SignResponse {
  success: boolean;
  documentId: string;
  uploadSessionId: string;
  path: string;
  uploadToken: string;
  expiresInSeconds: number;
  message?: string;
}

async function signUpload(
  fileName: string,
  fileSize: number,
  mimeType: string,
) {
  section("STEP 1: POST /uploads/sign");
  const { status, json } = await apiRequest<SignResponse>(
    "POST",
    "/uploads/sign",
    {
      fileName,
      fileSize,
      mimeType,
    },
  );

  log("sign", `status=${status}`, json);

  if (status !== 200 || !json.success) {
    throw new Error(`/uploads/sign failed: ${JSON.stringify(json)}`);
  }

  return json;
}

// ─────────────────────────────────────────────────────────────────────────
// Step 2: upload directly to Supabase Storage using the signed token
// ─────────────────────────────────────────────────────────────────────────

async function uploadToStorage(
  path: string,
  token: string,
  content: string,
): Promise<void> {
  section("STEP 2: Upload file to Supabase Storage (uploadToSignedUrl)");

  const fileBuffer = Buffer.from(content, "utf-8");

  const { data, error } = await supabase.storage
    .from("documents")
    .uploadToSignedUrl(path, token, fileBuffer, {
      contentType: "text/plain",
    });

  if (error) {
    throw new Error(`uploadToSignedUrl failed: ${error.message}`);
  }

  log("upload", "uploaded successfully", data);
}

// ─────────────────────────────────────────────────────────────────────────
// Step 3: complete
// ─────────────────────────────────────────────────────────────────────────

interface CompleteResponse {
  success: boolean;
  documentId: string;
  storagePath: string;
  verified: boolean;
  nextStage: string;
  message?: string;
}

async function completeUpload(documentId: string, uploadSessionId: string) {
  section("STEP 3: POST /uploads/complete");
  const { status, json } = await apiRequest<CompleteResponse>(
    "POST",
    "/uploads/complete",
    {
      documentId,
      uploadSessionId,
    },
  );

  log("complete", `status=${status}`, json);

  if (status !== 200 || !json.success) {
    throw new Error(`/uploads/complete failed: ${JSON.stringify(json)}`);
  }

  return json;
}

// ─────────────────────────────────────────────────────────────────────────
// Step 4: trigger analysis
// ─────────────────────────────────────────────────────────────────────────

interface AnalyzeResponse {
  documentId: string;
  analysisRequestId: string;
  currentStatus: string;
  requestStatus: string;
  workerId: string | null;
  sseUrl: string;
  deduplication: { isNewRequest: boolean; reason: string };
}

async function triggerAnalyze(documentId: string) {
  section("STEP 4: POST /documents/:id/analyze");
  const { status, json } = await apiRequest<AnalyzeResponse>(
    "POST",
    `/documents/${documentId}/analyze`,
  );

  log("analyze", `status=${status}`, json);

  if (status !== 202) {
    throw new Error(`/documents/:id/analyze failed: ${JSON.stringify(json)}`);
  }

  return json;
}

// ─────────────────────────────────────────────────────────────────────────
// Step 5: test idempotency - call analyze again, expect same request
// ─────────────────────────────────────────────────────────────────────────

async function testIdempotency(
  documentId: string,
  firstAnalysisRequestId: string,
) {
  section("STEP 5: Idempotency check - calling /analyze again");
  const { status, json } = await apiRequest<AnalyzeResponse>(
    "POST",
    `/documents/${documentId}/analyze`,
  );

  log("idempotency-check", `status=${status}`, json);

  if (json.analysisRequestId !== firstAnalysisRequestId) {
    logError(
      "idempotency-check",
      `MISMATCH! First request: ${firstAnalysisRequestId}, second: ${json.analysisRequestId}`,
    );
  } else if (json.deduplication?.isNewRequest === false) {
    log(
      "idempotency-check",
      "✅ PASSED - duplicate request correctly returned same analysisRequestId",
    );
  } else {
    logError(
      "idempotency-check",
      "⚠️  Unexpected: isNewRequest was true on a repeat call",
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Step 6: SSE stream
// ─────────────────────────────────────────────────────────────────────────

interface SseEventRecord {
  eventType: string;
  id: number | null;
  data: Record<string, unknown>;
}

async function streamSse(documentId: string): Promise<SseEventRecord[]> {
  section("STEP 6: GET /documents/:id/events (SSE)");

  const events: SseEventRecord[] = [];

  const res = await fetch(`${BASE_URL}/documents/${documentId}/events`, {
    headers: {
      Cookie: `accessToken=${ACCESS_TOKEN}`,
      Accept: "text/event-stream",
    },
  });

  if (!res.ok || !res.body) {
    throw new Error(`SSE connection failed: status=${res.status}`);
  }

  log("sse", "connected, streaming events...");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new Promise<SseEventRecord[]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reader.cancel().catch(() => {});
      reject(
        new Error(
          `SSE timed out after ${SSE_TIMEOUT_MS / 1000}s waiting for completion`,
        ),
      );
    }, SSE_TIMEOUT_MS);

    function finish() {
      clearTimeout(timeout);
      reader.cancel().catch(() => {});
      resolve(events);
    }

    async function pump(): Promise<void> {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish();
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? ""; // keep incomplete trailing frame in buffer

        for (const frame of frames) {
          if (!frame.trim() || frame.startsWith(":")) {
            // comment / heartbeat frame
            if (frame.includes("heartbeat")) log("sse", "💓 heartbeat");
            continue;
          }

          const idMatch = frame.match(/^id: (.+)$/m);
          const eventMatch = frame.match(/^event: (.+)$/m);
          const dataMatch = frame.match(/^data: (.+)$/m);

          const eventType = eventMatch?.[1]?.trim() ?? "message";
          const id = idMatch ? Number.parseInt(idMatch[1].trim(), 10) : null;
          let data: Record<string, unknown> = {};
          if (dataMatch) {
            try {
              data = JSON.parse(dataMatch[1].trim());
            } catch {
              data = { raw: dataMatch[1].trim() };
            }
          }

          events.push({ eventType, id, data });
          log(
            "sse",
            `event=${eventType}`,
            `progress=${data.progress ?? "-"}`,
            data.message ?? "",
          );

          if (eventType === "analysis_completed" || eventType === "failed") {
            finish();
            return;
          }
        }

        await pump();
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    }

    void pump();
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Step 7: reconnect test - verify Last-Event-ID replay works
// ─────────────────────────────────────────────────────────────────────────

async function testSseReconnect(
  documentId: string,
  lastEventId: number,
): Promise<void> {
  section("STEP 7: SSE reconnect test (Last-Event-ID replay)");

  const res = await fetch(`${BASE_URL}/documents/${documentId}/events`, {
    headers: {
      Cookie: `accessToken=${ACCESS_TOKEN}`,
      Accept: "text/event-stream",
      "Last-Event-ID": String(lastEventId),
    },
  });

  if (!res.ok || !res.body) {
    throw new Error(`SSE reconnect failed: status=${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedSnapshot = false;
  let replayedCount = 0;

  const timeout = setTimeout(() => {
    reader.cancel().catch(() => {});
  }, 4000); // short connection, just to verify snapshot + no missing replay errors

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        if (!frame.trim() || frame.startsWith(":")) continue;
        const eventMatch = frame.match(/^event: (.+)$/m);
        const eventType = eventMatch?.[1]?.trim() ?? "message";
        if (eventType === "snapshot") receivedSnapshot = true;
        else replayedCount += 1;
        log("sse-reconnect", `event=${eventType}`);
      }
    }
  } finally {
    clearTimeout(timeout);
    reader.cancel().catch(() => {});
  }

  log(
    "sse-reconnect",
    receivedSnapshot
      ? "✅ snapshot received on reconnect"
      : "⚠️  no snapshot received",
    `(${replayedCount} replayed events after lastEventId=${lastEventId}, expected 0 since analysis already completed before this point)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(70));
  console.log("  DOCUMENT ANALYSIS PIPELINE - END TO END TEST");
  console.log(`  Target: ${BASE_URL}`);
  console.log("═".repeat(70));

  const fileContent = generateMockFileContent();
  const fileName = `pipeline-test-${Date.now()}.txt`;
  const fileSize = Buffer.byteLength(fileContent, "utf-8");
  const mimeType = "text/plain";

  log("mock-file", `name=${fileName} size=${fileSize} bytes`);

  // 1. sign
  const signResult = await signUpload(fileName, fileSize, mimeType);

  // 2. upload
  await uploadToStorage(signResult.path, signResult.uploadToken, fileContent);

  // 3. complete
  await completeUpload(signResult.documentId, signResult.uploadSessionId);

  // 4. analyze
  const analyzeResult = await triggerAnalyze(signResult.documentId);

  // 5. idempotency check
  await testIdempotency(signResult.documentId, analyzeResult.analysisRequestId);

  // 6. SSE stream until completion
  const events = await streamSse(signResult.documentId);

  // 7. reconnect test using the last event id we saw
  const lastEventId =
    events.length > 0 ? (events[events.length - 1].id ?? 0) : 0;
  if (lastEventId > 0) {
    await testSseReconnect(signResult.documentId, lastEventId);
  }

  // ── Final summary ──────────────────────────────────────────────────────
  section("FINAL SUMMARY");

  const completedEvent = events.find(
    (e) => e.eventType === "analysis_completed",
  );
  const failedEvent = events.find((e) => e.eventType === "failed");

  console.log(`Document ID:        ${signResult.documentId}`);
  console.log(`Analysis Request ID: ${analyzeResult.analysisRequestId}`);
  console.log(`Total SSE events:    ${events.length}`);
  console.log(
    `Event sequence:      ${events.map((e) => e.eventType).join(" → ")}`,
  );

  if (completedEvent) {
    console.log("\n✅ PIPELINE COMPLETED SUCCESSFULLY\n");
    console.log("Processing summary payload:");
    console.log(JSON.stringify(completedEvent.data.payload, null, 2));
  } else if (failedEvent) {
    console.log("\n❌ PIPELINE FAILED\n");
    console.log("Failure payload:");
    console.log(JSON.stringify(failedEvent.data.payload, null, 2));
    process.exitCode = 1;
  } else {
    console.log("\n⚠️  Stream ended without a terminal event (timeout?)\n");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  logError("fatal", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
