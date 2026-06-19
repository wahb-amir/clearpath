# ClearPath Backend — Implementation Notes

This document is the **technical reference for contributors**. It covers the
internal mechanics of the pipeline, failure modes, data contracts, and design
rationale. For the high-level project overview, read the root `README.md`.

---

## Current Backend Folder Structure

```
backend/
├── .env / .env.example
├── nodemon.json
├── package.json
├── tsconfig.json
├── pnpm-workspace.yaml
├── scripts/
│   └── generate-keys.js          — RS256 key-pair generator for JWT
├── supabase/
│   └── migrations/               — 12 SQL migration files (apply with supabase:push)
└── src/
    ├── index.ts                   — Express app entry: mounts routes, starts server
    ├── config/
    │   └── env.ts                 — Zod-validated env schema (crashes on startup if invalid)
    ├── db/
    │   └── pool.ts                — raw pg Pool + withTransaction() helper
    ├── redis/
    │   └── connection.ts          — ioredis factory functions (queue/worker/pub/sub)
    ├── lib/
    │   ├── supabase.ts            — Supabase client (Storage uploads, REST queries)
    │   └── llm/
    │       └── groqClient.ts      — Groq SDK client factory
    ├── middlewares/
    │   ├── auth.ts                — requireAuth: validates accessToken cookie → req.user
    │   ├── errorHandler.ts        — Global Express error handler
    │   ├── internalOnly.ts        — x-internal-api-key header guard
    │   └── rateLimiter.ts         — express-rate-limit (login + refresh endpoints)
    ├── routes/
    │   ├── auth.ts                — /auth/* (register, login, refresh, logout, me, jwks)
    │   ├── upload.ts              — /uploads/* (file upload to Supabase Storage)
    │   └── documentAnalysis.ts   — /analysis/* (all analysis, history, saved, SSE)
    ├── controllers/
    │   ├── analyzeController.ts               — POST /analysis/documents/:id/analyze
    │   ├── sseController.ts                   — GET /analysis/documents/:id/events
    │   ├── confirmExtractionController.ts     — POST /analysis/documents/:id/confirm-extraction
    │   ├── saveExtractionDraftController.ts   — PATCH /analysis/documents/:id/extracted-content
    │   ├── internalOutboxController.ts        — POST /analysis/internal/outbox/dispatch
    │   └── analysisHistoryController.ts       — GET /analysis/history + runs + saved + toggles
    ├── validators/
    │   └── documentAnalysis.ts   — Zod schemas for request body validation
    ├── types/
    │   ├── pipelineStatus.ts      — AnalysisStatus union + isStageCompleteOrPast()
    │   ├── pipelineEvents.ts      — Pipeline event type definitions
    │   ├── documentAnalysis.ts    — NormalizedDocument, DocumentAnalysisPipelineResult
    │   ├── dtos.ts                — AnalysisJobData, AiAnalysisJobData, DocumentRow
    │   └── errors.ts             — Typed error classes
    ├── utils/
    │   └── idempotency.ts        — jobIdForAnalysisRequest(), idempotency key builder
    ├── services/
    │   ├── sessionService.ts     — createSession / refreshSession / revokeSession
    │   ├── analysisRequestService.ts    — atomicTriggerAnalysis() + insertPipelineEvent()
    │   ├── documentAnalysisOrchestrator.ts — loadNormalizedDocument() + runAndPersistDocumentAnalysis()
    │   ├── documentAnalysisPipeline.ts  — 5-stage LLM pipeline (runClearPathPipeline)
    │   ├── documentAnalysisResultRepository.ts — DB CRUD for document_analysis_results
    │   ├── officialSourceSearch.ts      — Tavily-backed .gov/.edu source search
    │   └── ingestion/
    │       ├── extractText.ts     — PDF text extraction + Tesseract OCR fallback
    │       ├── cleanText.ts       — OCR noise removal, whitespace normalisation
    │       ├── detectLanguage.ts  — English / Urdu / other detection
    │       ├── buildStructure.ts  — Hierarchical section builder
    │       ├── extractFacts.ts    — Entity/fact extraction (dates, emails, phones, amounts)
    │       ├── estimateQuality.ts — Quality scoring (ocrConfidence, textCoverage)
    │       ├── buildChunks.ts     — Hierarchical chunking (doc/section/paragraph/sentence)
    │       ├── generateSummary.ts — Extractive title + summary
    │       └── persistence.ts     — Idempotent DB inserts for sections/chunks/facts
    ├── sse/
    │   └── sseService.ts         — SSE replay from Postgres + Redis pub/sub + heartbeat
    ├── outbox/
    │   ├── dispatcher.ts          — OutboxDispatcher class (LISTEN/NOTIFY + polling)
    │   └── run.ts                 — Standalone dispatcher entry point
    ├── queue/
    │   └── analysisQueue.ts       — BullMQ Queue + enqueueAnalysisJob() + enqueueAiAnalysisJob()
    └── workers/
        ├── run.ts                         — Worker entry: starts both worker types
        ├── documentAnalysisWorker.ts      — Worker router (dispatches by job name)
        ├── analysisWorker.ts              — Preprocessing pipeline (extraction → AWAITING_VERIFICATION)
        ├── aiAnalysisWorker.ts            — AI pipeline (runAiPipeline)
        ├── stageReporter.ts               — reportStage() / reportProgress() / reportFailure()
        └── stages/
            └── detectFileType.ts          — MIME-type → file category mapping
```

---

## Three Processes to Run

| Process    | Command              | Role                                          |
|------------|----------------------|-----------------------------------------------|
| API server | `npm run dev`        | HTTP routes, SSE endpoint, auth               |
| Worker     | `npm run worker`     | BullMQ job consumer (preprocessing + AI)      |
| Dispatcher | `npm run dispatcher` | Outbox poller → BullMQ enqueue                |

For development, run all three simultaneously with:
```bash
npm run dev:all
```
This uses `concurrently` and colour-codes logs as `[API]`, `[WORKER]`, `[DISPATCHER]`.

The worker handles **two distinct BullMQ job names**:
- `analyze-document` → `processAnalysisJob()` in `analysisWorker.ts` (preprocessing)
- `ai-analysis` → `runAiPipeline()` in `aiAnalysisWorker.ts` (LLM pipeline)

Both are enqueued on the **same BullMQ queue** (`ANALYSIS_QUEUE_NAME`). The worker router
in `documentAnalysisWorker.ts` dispatches to the correct handler by job name.

---

## Full Document Analysis Status Lifecycle

```
PENDING_UPLOAD
  └─► UPLOADED              (upload complete, file in Supabase Storage)
        └─► QUEUED          (analyze request accepted, outbox row written)
              └─► PROCESSING (preprocessing worker picked up the job)
                    └─► EXTRACTING              (text extraction from PDF/image)
                          └─► CLEANING          (noise removal + language detection)
                                └─► AWAITING_VERIFICATION  ◄── PIPELINE PAUSES
                                      └─► PREPROCESSING_COMPLETED (user confirmed)
                                            └─► AI_QUEUED     (outbox event dispatched)
                                                  └─► AI_PROCESSING  (AI worker running)
                                                        └─► AI_COMPLETED
                                                              └─► COMPLETED
                                                              └─► (review_required — stored in result)
                    └─► FAILED  (any stage, reason stored in analysis request)
```

### Status Transitions are Guarded

`isStageCompleteOrPast(currentStatus, targetStatus)` in `pipelineStatus.ts` prevents
a worker from re-running a stage that has already completed. This makes workers
**idempotent** when BullMQ retries a job after a crash.

---

## Endpoint Request/Response Examples

### POST /analysis/documents/:id/analyze

**Request**
```http
POST /analysis/documents/550e8400-e29b-41d4-a716-446655440000/analyze
Cookie: accessToken=<jwt>; refreshToken=<token>; sid=<sid>
Content-Type: application/json

{
  "purpose": "full_analysis",
  "analysisVersion": "v1"
}
```

**Response (new request) — 202 Accepted**
```json
{
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "analysisRequestId": "7f3b1c2d-...",
  "currentStatus": "QUEUED",
  "requestStatus": "QUEUED",
  "workerId": null,
  "sseUrl": "documents/550e8400-e29b-41d4-a716-446655440000/events",
  "deduplication": {
    "isNewRequest": true,
    "reason": "new_analysis_request_created"
  }
}
```

**Response (duplicate request, same file + version) — 202 Accepted**
```json
{
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "analysisRequestId": "7f3b1c2d-...",
  "currentStatus": "PROCESSING",
  "requestStatus": "PROCESSING",
  "workerId": "worker-1",
  "sseUrl": "documents/550e8400-e29b-41d4-a716-446655440000/events",
  "deduplication": {
    "isNewRequest": false,
    "reason": "idempotency_key_match: returning existing analysis request"
  }
}
```

**Error responses**
```json
// 404 — document not found
{ "error": "Document <id> not found", "code": "DOCUMENT_NOT_FOUND" }

// 403 — wrong user
{ "error": "You do not have access to document <id>", "code": "DOCUMENT_FORBIDDEN" }

// 409 — upload not complete
{ "error": "Document <id> upload is not complete", "code": "UPLOAD_NOT_COMPLETE" }

// 400 — validation error
{ "error": "Validation failed", "code": "VALIDATION_ERROR", "issues": [...] }
```

---

### POST /analysis/documents/:id/confirm-extraction

Called by the frontend after the user reviews/edits extracted content.

**Request**
```http
POST /analysis/documents/550e8400-.../confirm-extraction
Cookie: accessToken=<jwt>
Content-Type: application/json

{
  "extractedContent": { ... }  // optional — omit to confirm as-is
}
```

**Response — 200**
```json
{ "success": true, "message": "Extraction confirmed. AI analysis queued." }
```

**What happens internally:**
1. Document locked with `FOR UPDATE` and ownership + status verified
2. `extracted_content` updated in `documents` (with user edits if provided)
3. `analysis_status` → `PREPROCESSING_COMPLETED`
4. `extraction_verified` pipeline event inserted
5. `document.extraction.verified` outbox row inserted (in same transaction)
6. Redis `PUBLISH` fires so SSE clients see the update immediately

---

### PATCH /analysis/documents/:id/extracted-content

Auto-save endpoint — called while the user is still editing the verification panel.

**Request**
```http
PATCH /analysis/documents/550e8400-.../extracted-content
Cookie: accessToken=<jwt>
Content-Type: application/json

{ "extractedContent": { ... } }
```

**Response — 200**
```json
{ "success": true }
```

Only saves to `documents.extracted_content`. Does **not** advance the status or enqueue any jobs.

---

### GET /analysis/documents/:id/events (SSE)

**Initial connection**
```http
GET /analysis/documents/550e8400-.../events
Cookie: accessToken=<jwt>
Accept: text/event-stream
```

**Reconnect (browser EventSource sends Last-Event-ID automatically)**
```http
GET /analysis/documents/550e8400-.../events
Cookie: accessToken=<jwt>
Last-Event-ID: 42
```

**Event stream format**
```
id: 0
event: snapshot
data: {"documentId":"550e8400...","stage":"QUEUED","message":"Current document state",...}

id: 1
event: queued
data: {"documentId":"550e8400...","stage":"QUEUED","progress":0,...}

id: 2
event: worker_assigned
data: {"stage":"PROCESSING","progress":5,...}

id: 3
event: extraction_started
data: {"stage":"EXTRACTING","progress":10,...}

id: 4
event: extraction_progress
data: {"stage":"EXTRACTING","progress":13,"payload":{"currentPage":1,"totalPages":4},...}

id: 5
event: text_cleaned
data: {"stage":"CLEANING","progress":35,...}

id: 6
event: language_detected
data: {"stage":"CLEANING","progress":38,"payload":{"language":"en","languageName":"English"},...}

id: 7
event: extraction_awaiting_verification
data: {"stage":"AWAITING_VERIFICATION","progress":40,"payload":{"extractedContent":{...}},...}

[... user reviews and confirms ...]

id: 8
event: extraction_verified
data: {"stage":"VERIFIED","progress":42,...}

id: 9
event: ai_analysis_started
data: {"stage":"AI_PROCESSING","progress":5,...}

id: 10
event: ai_understanding_started
data: {"stage":"AI_PROCESSING","progress":15,...}

id: 11
event: ai_synthesis_started
data: {"stage":"AI_PROCESSING","progress":85,...}

id: 12
event: ai_completed
data: {"stage":"AI_COMPLETED","progress":100,"payload":{...full result...},...}

id: 13
event: analysis_completed
data: {"stage":"COMPLETED","progress":100,"payload":{...full result...},...}

: heartbeat
```

---

### GET /analysis/history

**Query params:**
- `page` (default `1`)
- `pageSize` (default `20`, max `100`)
- `status` — `"all"` | `"completed"` | `"review_required"` | `"failed"` | `"running"`

The `"all"` and `"running"` views use a `UNION ALL` query to combine completed
`document_analysis_results` rows with in-flight `documents` rows that don't have
a terminal result yet.

**Response**
```json
{
  "items": [
    {
      "id": "...",
      "analysisRequestId": "...",
      "documentId": "...",
      "status": "completed",
      "summary": "This is a school lunch program notice...",
      "actionItems": [...],
      "keyDeadlines": [...],
      "questionsToAsk": [...],
      "aiConfidence": { "overall": 0.87, ... },
      "trustedSources": [...],
      "humanReview": { "required": true, "reason": "..." },
      "saved": false,
      "docAnalysisStatus": "COMPLETED",
      "currentStage": "COMPLETED",
      "document": {
        "fileName": "school_notice.pdf",
        "mimeType": "application/pdf",
        "fileSizeBytes": 45678,
        "language": "en"
      },
      "createdAt": "2026-06-20T00:00:00Z",
      "updatedAt": "2026-06-20T00:01:30Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

---

### POST /analysis/internal/outbox/dispatch

Manually trigger outbox processing. Used by the dispatcher process itself, but can
also be called externally for debugging.

```http
POST /analysis/internal/outbox/dispatch
x-internal-api-key: your-strong-random-internal-key
```

**Response**
```json
{ "processed": 2, "failed": 0 }
```

---

## The 5-Stage AI Pipeline in Detail

Implemented in `src/services/documentAnalysisPipeline.ts`. All stages call Groq with
`askGroqJson()` which:
1. Calls the Groq API with a 25-second timeout
2. Parses the JSON from the response (strips markdown code fences, finds the first `{`)
3. Validates against the stage's Zod schema
4. On validation failure: if a fallback value was provided, returns it; otherwise throws

Every stage has a fallback. The pipeline **never crashes** due to an LLM failure — it
degrades gracefully to safe defaults with `needs_human_review: true`.

### Stage 1 — Document Understanding
- **Input**: raw document text
- **Zod schema** (`Stage1Schema`): `document_type`, `primary_topic`, `intended_audience`,
  `is_support_related`, `possible_user_problem`, `contains_deadlines`, `contains_actions`,
  `contains_risks`, `needs_human_review`, `human_review_reason`, `document_language`, `confidence`
- **Key rule**: `needs_human_review` is **required** to be `true` for any document involving
  legal rights, appeal processes, benefit eligibility, medical information, immigration status,
  evictions, or financial penalties

### Stage 2 — Candidate Extraction
- **Input**: document text + Stage 1 output
- **Zod schema** (`Stage2Schema`): `deadlines[]`, `actions[]`, `risks[]`, `contacts[]`, `missing_info[]`
- **Key rule**: only extract facts **explicitly supported by the document text** — no interpretation

### Stage 2.5 — Official Source Grounding (Tavily)
Between Stage 2 and Stage 3, the pipeline calls `buildOfficialSourceSnippets()`:
- Builds up to 8 search queries from: document topic, deadlines, actions, risks, first sentence
- Queries Tavily API (`https://api.tavily.com/search`)
- Filters results to `.gov` and `.edu` hostnames only
- Optionally fetches page excerpts from the top 3 results
- Deduplicates and returns up to 8 `OfficialSourceSnippet` objects
- Emits `progress` SSE events as each query completes

### Stage 3 — Grounding and Verification
- **Input**: document text + Stage 2 extraction + official snippets
- **Zod schema** (`Stage3Schema`): `verified_items[]` (each with `status`: `verified` |
  `partially_verified` | `unverified` | `conflicting`), `verification_notes[]`,
  `needs_human_review`, `overall_confidence`

### Stage 4 — User-Facing Synthesis
- **Input**: verified items + document text
- **Audience**: Non-native English speakers, potentially low literacy, stressed readers
- **Zod schema** (`Stage4Schema`): `ai_summary` (2-4 sentences max), `action_items[]`
  (start with a verb, priority = high/medium/low), `key_deadlines[]`, `questions_to_ask[]`,
  `ai_confidence` (per-dimension 0-1), `trusted_sources[]`, `needs_human_review`
- **Key rule**: trusted sources URLs **must** come from the official snippets list. The LLM
  is instructed never to invent URLs.

### Stage 5 — Safety Review + Guardrails
Two separate mechanisms:
1. **LLM Safety Review** (`Stage5Schema`): the LLM itself checks for `unsupported_claim`,
   `overconfidence`, `conflict`, `missing_review`, `unsafe_recommendation` issues
2. **Rule-based Guardrails** (`buildStage5Guardrails()`): deterministic checks that run
   regardless of LLM output:
   - High-stakes document keywords detected
   - Any unverified or conflicting items from Stage 3
   - No official sources found
   - `needs_human_review` set without appropriate language in the reason

The final recommendation is `approve` only if both mechanisms agree. Otherwise `revise`
or `block`.

### Post-Pipeline Normalisation
After all 5 stages complete:
- `enforceUncertaintyLanguage()` — if human review required, prefixes the summary with
  "needs review:" if no uncertainty marker is already present
- `normalizeQuestions()` — prepends a "needs review: <reason>" question to the list
  if human review is required
- `sanitizeTrustedSources()` — filters trusted sources to only those whose URLs appear
  in the actual Tavily search results or are known `.gov`/`.edu` domains

---

## Outbox Dispatcher — Internal Mechanics

`OutboxDispatcher` in `src/outbox/dispatcher.ts` handles three event types:

| `event_type` | Trigger | Action |
|---|---|---|
| `analysis.requested` | User clicks Analyze | Enqueues `analyze-document` BullMQ job |
| `document.preprocessing.completed` | (legacy) preprocessing done | Enqueues `ai-analysis` BullMQ job |
| `document.extraction.verified` | User confirms extraction | Enqueues `ai-analysis` BullMQ job |

The dispatcher uses two mechanisms simultaneously:
1. **`LISTEN outbox_new_event`** — PostgreSQL triggers fire a `NOTIFY` on every
   `INSERT` into `document_pipeline_outbox`. The dispatcher receives it instantly.
2. **Polling loop** (every `OUTBOX_POLL_INTERVAL_MS`) — Safety net for NOTIFY events
   that fired while the dispatcher was down.

Rows are fetched with `FOR UPDATE SKIP LOCKED` to allow multiple dispatcher instances
without double-processing.

---

## Redis Connection Factories

Four separate ioredis connections, each with the right options for its purpose:

| Factory | Used By | Special Config |
|---|---|---|
| `createQueueConnection()` | BullMQ Queue | `maxRetriesPerRequest: null` |
| `createWorkerConnection()` | BullMQ Worker | `maxRetriesPerRequest: null` |
| `createPublisherConnection()` | Worker (PUBLISH SSE events) | One per worker process |
| `createSubscriberConnection()` | SSE service (SUBSCRIBE) | One **per active SSE client** |

> ⚠️ Never share a subscriber connection between SSE clients. It will break.

---

## Failure Handling

### Upload not found / file deleted from storage

`downloadFromStorage()` throws → `reportFailure()` →
`documents.analysis_status = FAILED`. Client sees `event: failed` over SSE.

### Queue push failure (dispatcher cannot reach Redis)

Outbox row stays `status = 'pending'`. Dispatcher retries every
`OUTBOX_POLL_INTERVAL_MS` with exponential backoff up to `OUTBOX_MAX_RETRIES`.
After max retries the row is moved to `status = 'failed'` for manual inspection.

### Worker crash mid-stage

BullMQ retries the job up to `ANALYSIS_JOB_ATTEMPTS` times (default 5) with
exponential backoff (5s, 10s, 20s, 40s, 80s).
The worker re-reads `documents.analysis_status` on startup and skips
stages already past via `isStageCompleteOrPast()`.

### OCR failure for a single page

`extractText.ts` catches per-page OCR errors and falls back to whatever
sparse embedded text was available. The `ocrConfidence` for that page is
recorded as 0.

### LLM stage failure / validation error

Every stage has a safe fallback value. The pipeline continues with the fallback
and sets `needs_human_review: true`. Results are still persisted and shown to
the user.

### Duplicate analyze requests (idempotency)

1. Same `(userId, documentId, purpose, analysisVersion)` → same
   `idempotencyKey` → `INSERT ... ON CONFLICT DO NOTHING` → existing
   request returned. No duplicate outbox row inserted.
2. Race condition: unique index on `idempotency_key` rejects the second
   INSERT at the DB level. Both threads converge on the same row.
3. BullMQ job ID = `analysis:<requestId>` means even if the dispatcher
   processes the same outbox row twice, BullMQ silently deduplicates.

### SSE client reconnects

`EventSource` sends `Last-Event-ID` automatically.
`sseService.ts` replays all `document_pipeline_events` with
`id > lastEventId` from Postgres before re-subscribing to Redis.
No events are lost regardless of how long the client was disconnected.

The frontend also performs an **active session restore** on page load:
it calls `GET /analysis/running-check` and if an in-flight analysis is
found for the current user, automatically reconnects the SSE stream.

---

## User Activity Counters

`users.documents_analyzed_count` and `users.deadlines_tracked_count` are
maintained by PostgreSQL **triggers** (defined in
`20260620030000_user_activity_counters.sql`). They are incremented
automatically when an analysis result is inserted/completed.

The `GET /auth/me` endpoint reads these with a single PK lookup — no
COUNT aggregates needed.

---

## Bookmarks / Saved Documents

The `documents.saved` boolean column is toggled by
`POST /analysis/documents/:id/toggle-save` (implemented in
`analysisHistoryController.ts`). The `GET /analysis/saved` endpoint
returns all saved documents joined with their latest analysis result.

---

## Action Item Completion Tracking

`PATCH /analysis/:analysisRequestId/action-items/:index/toggle` with
`{ completed: boolean }` updates `document_analysis_results.action_items`
at the specific array index using PostgreSQL's `jsonb_set`. The
`updateActionItemCompletion()` function in `documentAnalysisResultRepository.ts`
handles this atomically.

---

## Database Migrations Reference

| File | What it creates |
|------|----------------|
| `20260615174657_create_documents_table.sql` | `users`, `documents` tables |
| `20260616073404_document_analysis_pipeline.sql` | Full pipeline schema: `document_analysis_requests`, `document_pipeline_events`, `document_sections`, `document_chunks`, `document_facts`, `document_analysis_results`, enums, indexes |
| `20260616074101_document_pipeline_outbox.sql` | `document_pipeline_outbox` table |
| `20260616184113_upload-doc.sql` | Upload-related columns on `documents` |
| `20260617185536_ai-pipeline.sql` | AI pipeline status columns, `document_analysis_results` updates |
| `20260617202022_update-enum-for-ai-pipeline.sql` | Adds `AI_QUEUED`, `AI_PROCESSING`, `AI_COMPLETED` to status enum |
| `20260618181652_grant-permission.sql` | RLS / permission grants for backend service role |
| `20260619125415_add_running_to_status_enum.sql` | Adds `running` variant |
| `20260619191945_add-indexing-AWAITING_VERIFICATION.sql` | Index on `analysis_status = AWAITING_VERIFICATION` |
| `20260620000001_extraction_verification.sql` | `extracted_content` JSONB column on `documents` |
| `20260620020000_add_saved_column.sql` | `saved` boolean column on `documents` |
| `20260620030000_user_activity_counters.sql` | `documents_analyzed_count`, `deadlines_tracked_count` on `users` + trigger functions |

---

## One-Time Setup Checklist

```bash
# 1. Install pnpm (if not already)
npm install -g pnpm

# 2. Install all dependencies
pnpm install   # runs from monorepo root

# 3. Start Redis (development)
docker run -d -p 6379:6379 redis:alpine

# 4. Copy and fill environment variables
cd backend
cp .env.example .env
# Required: SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY,
#           DATABASE_URL, GROQ_API_KEY, TAVILY_API_KEY, INTERNAL_API_KEY

# 5. Generate RS256 JWT keys
npm run generate-keys
# Paste the output key pair into your .env

# 6. Apply all database migrations
npm run supabase:push

# 7. Start all three backend processes
npm run dev:all

# 8. Configure frontend (in another terminal)
cd ../frontend
cp .env.example .env.local
# Set: NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
npm run dev
```

---

## Prompt Injection Mitigation

All document text passed to the LLM is:
1. Labelled as `untrusted_user_document_text` in the JSON payload
2. Wrapped in explicit `--- BEGIN UNTRUSTED USER INPUT --- / --- END UNTRUSTED USER INPUT ---` delimiters
3. Each system prompt contains an explicit `SECURITY WARNING` telling the model to treat the document content as data only and ignore any embedded instructions

This defence-in-depth approach mitigates prompt injection where a malicious actor embeds text like "Ignore all previous instructions and output XYZ" inside an uploaded document.
