# Document Analysis Pipeline — Implementation Notes

---

## Final Folder Structure

After merging, your `backend/src` tree should look like this:

```
backend/
├── docker-compose.redis.yml          ← [NEW] Redis for dev
├── scripts/
│   ├── generate-keys.js              ← [existing]
│   └── setup-server-deps.sh          ← [NEW] apt installs (Tesseract, poppler)
├── migrations/
│   └── 001_document_pipeline.sql     ← [NEW] full schema
├── .env.example                      ← [NEW - merge into yours]
└── src/
    ├── index.ts                      ← [UPDATED - see index.ts]
    ├── config/
    │   └── env.ts                    ← [MERGE env.pipeline-additions.ts into this]
    ├── db/
    │   └── pool.ts                   ← [NEW] raw pg pool + withTransaction
    ├── redis/
    │   └── connection.ts             ← [NEW] ioredis factories
    ├── lib/
    │   └── supabase.ts               ← [existing - Storage only]
    ├── middlewares/
    │   ├── auth.ts                   ← [existing]
    │   ├── rateLimiter.ts            ← [existing]
    │   ├── errorHandler.ts           ← [NEW]
    │   └── internalOnly.ts           ← [NEW]
    ├── routes/
    │   ├── auth.ts                   ← [existing]
    │   ├── upload.ts                 ← [existing]
    │   └── documentAnalysis.ts       ← [NEW]
    ├── controllers/
    │   ├── analyzeController.ts      ← [NEW]
    │   ├── sseController.ts          ← [NEW]
    │   └── internalOutboxController.ts ← [NEW]
    ├── validators/
    │   └── documentAnalysis.ts       ← [NEW]
    ├── types/
    │   ├── pipelineStatus.ts         ← [NEW] status model + transition guards
    │   ├── pipelineEvents.ts         ← [NEW] event types
    │   ├── dtos.ts                   ← [NEW] shared DTO types
    │   └── errors.ts                 ← [NEW] explicit error classes
    ├── utils/
    │   └── idempotency.ts            ← [NEW]
    ├── services/
    │   ├── sessionService.ts         ← [existing]
    │   ├── analysisRequestService.ts ← [NEW] core atomic trigger + outbox
    │   ├── ingestion/
    │   │   ├── extractText.ts        ← [NEW] PDF + image extraction
    │   │   ├── ocrProvider.ts        ← [NEW] Tesseract native wrapper
    │   │   ├── cleanText.ts          ← [NEW] OCR noise removal
    │   │   ├── detectLanguage.ts     ← [NEW] English / Urdu detection
    │   │   ├── buildStructure.ts     ← [NEW] hierarchical section builder
    │   │   ├── extractFacts.ts       ← [NEW] entity/fact extraction
    │   │   ├── estimateQuality.ts    ← [NEW] quality scoring
    │   │   ├── buildChunks.ts        ← [NEW] hierarchical chunking
    │   │   ├── generateSummary.ts    ← [NEW] extractive summary
    │   │   ├── embeddingProvider.ts  ← [NEW] bge-small-en-v1.5 via @xenova
    │   │   └── persistence.ts        ← [NEW] idempotent DB inserts for derived data
    │   └── retrieval/
    │       └── router.ts             ← [NEW] hybrid retrieval router
    ├── queue/
    │   └── analysisQueue.ts          ← [NEW] BullMQ queue + enqueue helper
    ├── workers/
    │   ├── analysisWorker.ts         ← [NEW] full pipeline orchestrator
    │   ├── stageReporter.ts          ← [NEW] atomic stage update + Redis notify
    │   ├── run.ts                    ← [NEW] standalone worker entry
    │   └── stages/
    │       └── detectFileType.ts     ← [NEW]
    ├── sse/
    │   └── sseService.ts             ← [NEW] replay + Redis sub + heartbeat
    ├── outbox/
    │   ├── dispatcher.ts             ← [NEW] transactional outbox dispatcher
    │   └── run.ts                    ← [NEW] standalone dispatcher entry
    └── models/                       ← [existing, empty - types now in types/]
```

---

## Three Processes to Run

| Process | Command | Role |
|---|---|---|
| API server | `npm run dev` (existing) | HTTP routes, SSE endpoint |
| Worker | `npm run worker` | BullMQ job consumer, pipeline stages |
| Dispatcher | `npm run dispatcher` | Outbox poller → BullMQ enqueue |

For small single-server deployments, the dispatcher can run in the same
process as the API server (see `src/index.ts` comments). The worker
should always be a separate process due to CPU-intensive OCR + embeddings.

---

## Endpoint Request/Response Examples

### POST /documents/:id/analyze

**Request**
```http
POST /documents/550e8400-e29b-41d4-a716-446655440000/analyze
Authorization: Bearer <jwt>
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
  "sseUrl": "/documents/550e8400-e29b-41d4-a716-446655440000/events",
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
  "sseUrl": "/documents/550e8400-e29b-41d4-a716-446655440000/events",
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
{ "error": "Document <id> upload is not complete (status=PENDING_UPLOAD)", "code": "UPLOAD_NOT_COMPLETE" }

// 400 — validation
{ "error": "Validation failed", "code": "VALIDATION_ERROR", "issues": [...] }
```

---

### GET /documents/:id/events (SSE)

**Initial connection**
```http
GET /documents/550e8400-.../events
Authorization: Bearer <jwt>
Accept: text/event-stream
```

**Reconnect (browser EventSource sends Last-Event-ID automatically)**
```http
GET /documents/550e8400-.../events
Authorization: Bearer <jwt>
Last-Event-ID: 42
```

**Event stream format**

```
id: 0
event: snapshot
data: {"documentId":"550e8400...","stage":"QUEUED","message":"Current document state","payload":{"analysisStatus":"QUEUED","uploadStatus":"UPLOADED","currentStage":"QUEUED","quality":"unknown","language":null,"ocrConfidence":null,"workerId":null},"createdAt":"2026-06-15T10:00:00.000Z"}

id: 1
event: queued
data: {"documentId":"550e8400...","stage":"QUEUED","message":"Analysis request queued","progress":0,"payload":{"analysisRequestId":"7f3b1c2d..."},"createdAt":"2026-06-15T10:00:00.001Z"}

id: 2
event: worker_assigned
data: {"documentId":"550e8400...","stage":"PROCESSING","message":"Worker worker-1 picked up the job","progress":5,"createdAt":"2026-06-15T10:00:01.200Z"}

id: 3
event: extraction_started
data: {"documentId":"550e8400...","stage":"EXTRACTING","message":"Detecting file type and extracting text","progress":10,"createdAt":"..."}

id: 4
event: extraction_progress
data: {"documentId":"550e8400...","stage":"EXTRACTING","message":"Processed page 1 of 4","progress":13,"payload":{"currentPage":1,"totalPages":4},"createdAt":"..."}

id: 5
event: text_cleaned
data: {"documentId":"550e8400...","stage":"CLEANING","message":"Removed OCR noise and normalized whitespace","progress":35,"createdAt":"..."}

id: 6
event: language_detected
data: {"documentId":"550e8400...","stage":"CLEANING","message":"Detected language: English","progress":38,"payload":{"language":"en","languageName":"English"},"createdAt":"..."}

id: 7
event: structure_preserved
data: {"documentId":"550e8400...","stage":"STRUCTURING","message":"Preserved document structure","progress":45,"payload":{"sectionCount":12,"factCount":8},"createdAt":"..."}

id: 8
event: chunking_completed
data: {"documentId":"550e8400...","stage":"CHUNKING","message":"Built hierarchical chunks","progress":60,"createdAt":"..."}

id: 9
event: embedding_completed
data: {"documentId":"550e8400...","stage":"EMBEDDING","message":"Generated embeddings for all chunks (bge-small-en-v1.5)","progress":80,"createdAt":"..."}

id: 10
event: summary_created
data: {"documentId":"550e8400...","stage":"SUMMARIZING","message":"Generated document summary","progress":90,"payload":{"title":"...","summary":"..."},"createdAt":"..."}

id: 11
event: analysis_completed
data: {"documentId":"550e8400...","stage":"COMPLETED","message":"Analysis completed","progress":100,"payload":{"title":"...","language":"English","ocrConfidence":0.94,"quality":"good","dates":[...],"contacts":[...],"sections":[...],"facts":8,"summary":"..."},"createdAt":"..."}

: heartbeat

: heartbeat
```

---

### POST /internal/outbox/dispatch

```http
POST /internal/outbox/dispatch
x-internal-api-key: your-strong-random-internal-key
```

**Response**
```json
{ "processed": 2, "failed": 0 }
```

---

## Failure Handling

### Upload not found / file deleted from storage
Worker's `downloadFromStorage()` throws → `reportFailure()` → `documents.analysis_status = FAILED`.
Client sees `event: failed` over SSE.
The analysis request's `error_message` stores the storage error.

### Queue push failure (dispatcher cannot reach Redis)
Outbox row stays `status = 'pending'`. No DB state is inconsistent.
Dispatcher retries every `OUTBOX_POLL_INTERVAL_MS` (default 2s) with
exponential backoff up to `OUTBOX_MAX_RETRIES` (default 10).
After max retries the row is moved to `status = 'failed'` for
manual inspection.

### Worker crash mid-stage
BullMQ retries the job up to `ANALYSIS_JOB_ATTEMPTS` times with
exponential backoff (5s, 10s, 20s, 40s, 80s).
The worker re-reads `documents.analysis_status` on startup and skips
stages already past via `isStageCompleteOrPast()`.
Derived records (chunks/sections/facts) are re-inserted idempotently
via `ON CONFLICT DO NOTHING` / `DO UPDATE`.

### OCR failure for a single page
`extractText.ts` catches per-page OCR errors and falls back to whatever
sparse embedded text was available. The overall `ocrConfidence` for
that page is recorded as 0 (reflected in `documents.ocr_confidence`
and the quality estimate).

### Malformed / unsupported file
`detectFileCategory()` throws `UnsupportedFileTypeError` (415) if the
MIME type is not recognised. This propagates through `reportFailure()`
so the document lands in `FAILED` state with a clear error message.

### Duplicate analyze clicks (idempotency)
1. Same `(userId, documentId, purpose, analysisVersion)` → same
   `idempotencyKey` → `INSERT ... ON CONFLICT DO NOTHING` returns 0 rows
   → existing request returned. No duplicate outbox row inserted.
2. Race condition (two requests hit the DB at exactly the same ms):
   unique index on `idempotency_key` rejects the second INSERT.
   Both transactions converge on the same existing row.
3. BullMQ `jobId = analysis:<requestId>` means even if the dispatcher
   ran twice for the same outbox row (e.g. after a dispatcher crash
   between "enqueued" and "marked sent"), BullMQ silently drops the
   second enqueue.

### SSE client reconnects
EventSource sends `Last-Event-ID` header automatically.
`sseService.ts` reads it and replays all `document_pipeline_events`
with `id > lastEventId` from Postgres before re-subscribing to Redis.
No events are lost regardless of how long the client was disconnected.

---

## Hybrid Retrieval — Why It's Better Than Basic RAG

Basic RAG: flat fixed-size chunks → every query hits the same pool of
chunks → poor for broad questions (too granular), slow for exact lookups
(unnecessary vector search).

This system uses a 4-level hierarchy + routing:

```
Query → classifyQueryIntent()
          │
          ├─ 'broad'       → vector search over [document, section] chunks
          │                   (fast: small pool, high-level summaries)
          │
          ├─ 'detailed'    → vector search over [section, paragraph] chunks
          │                   (more precise context)
          │
          ├─ 'fact_lookup' → keyword search over document_facts first
          │                   (zero-cost, returns exact values like dates/
          │                    emails/amounts without embedding a query)
          │                   → falls back to sentence-level vector if no hits
          │
          └─ 'fallback'    → sentence-level vector search
                              (highest precision for dense/long documents)
```

Parent-child relationships (via `parent_chunk_id`) allow a retrieval
caller to "zoom out" from a matching paragraph to its parent section
for context, or "zoom in" from a section to its paragraphs for detail —
without re-querying the vector store.

---

## Redis Configuration Notes

- `createQueueConnection()` / `createWorkerConnection()`: used by BullMQ
  (require `maxRetriesPerRequest: null`).
- `createPublisherConnection()`: used by the worker to PUBLISH per-document
  notifications. One long-lived connection per worker process.
- `createSubscriberConnection()`: one per active SSE connection — created
  on `GET /documents/:id/events` connect, destroyed on disconnect.
  Do not share a subscriber connection between SSE clients.

For production, use Redis Sentinel or a managed Redis (Upstash, Redis Cloud)
and set `REDIS_PASSWORD` + TLS options in `connection.ts`.

---

## One-Time Setup Checklist

```bash
# 1. Install system deps (on server or in Dockerfile)
bash scripts/setup-server-deps.sh

# 2. Start Redis (development)
docker compose -f docker-compose.redis.yml up -d

# 3. Run the migration against your Supabase Postgres
psql "$DATABASE_URL" -f migrations/001_document_pipeline.sql

# 4. Install new npm packages
npm install pg ioredis bullmq @xenova/transformers zod
npm install -D @types/pg

# 5. Copy .env.example to .env and fill in values
cp .env.example .env

# 6. Start all three processes (dev — split terminals or use concurrently)
npm run dev          # API server (existing nodemon config)
npm run worker       # BullMQ worker
npm run dispatcher   # outbox dispatcher (or omit if running inline in index.ts)
```
