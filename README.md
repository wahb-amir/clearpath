# ClearPath

ClearPath is an AI-powered document intelligence platform built to help immigrants, refugees, and underserved communities understand complex official documents (notices, forms, legal letters, benefit communications, etc.).

A user uploads a document → the system runs a multi-stage preprocessing and AI analysis pipeline → the user receives a plain-English summary, prioritised action items, key deadlines, clarifying questions to ask a case worker, and links to relevant official sources.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Monorepo Structure](#monorepo-structure)
- [Tech Stack](#tech-stack)
- [How the Pipeline Works](#how-the-pipeline-works)
- [Authentication System](#authentication-system)
- [Database Schema (Supabase / PostgreSQL)](#database-schema)
- [API Reference](#api-reference)
- [Frontend Pages & Components](#frontend-pages--components)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)
- [Deployment Notes](#deployment-notes)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                     │
│   /analyze  /history  /saved  /profile  /settings            │
│                                                              │
│   Upload → SSE stream → Verification Panel → Results Panel  │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTPS (httpOnly cookies)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    Backend (Express + TypeScript)             │
│                                                              │
│  /auth    /uploads    /analysis    /api/health               │
│                                                              │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │   API Server │   │   Dispatcher  │   │  BullMQ Workers  │  │
│  │  (HTTP/SSE) │   │  (Outbox poll│   │  (Preprocessing  │  │
│  │             │   │   + LISTEN)   │   │   + AI Pipeline) │  │
│  └──────┬──────┘   └──────┬───────┘   └───────┬──────────┘  │
└─────────┼─────────────────┼───────────────────┼─────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐
   │  Supabase   │   │    Redis    │   │   Groq LLM API  │
   │  (Postgres  │   │  (BullMQ   │   │  (llama-3.3-70b)│
   │   Storage)  │   │   queues + │   │                 │
   │             │   │   pub/sub) │   │  Tavily Search  │
   └─────────────┘   └─────────────┘   └─────────────────┘
```

### Three Backend Processes

| Process    | Command              | Responsibility                                  |
|------------|----------------------|-------------------------------------------------|
| API Server | `pnpm run dev`        | HTTP routes, SSE streaming, auth                |
| Worker     | `pnpm run worker`     | BullMQ job consumer — preprocessing + AI stages |
| Dispatcher | `pnpm run dispatcher` | Outbox poller → enqueues BullMQ jobs            |

For development, `pnpm run dev:all` starts all three concurrently via `concurrently`.

---

## Monorepo Structure

```
clearpath/
├── backend/                    # Express + TypeScript API
│   ├── src/
│   │   ├── config/env.ts       # Zod-validated env schema
│   │   ├── controllers/        # Route handler functions
│   │   │   ├── analyzeController.ts
│   │   │   ├── analysisHistoryController.ts
│   │   │   ├── confirmExtractionController.ts
│   │   │   ├── saveExtractionDraftController.ts
│   │   │   ├── sseController.ts
│   │   │   └── internalOutboxController.ts
│   │   ├── db/pool.ts          # Raw pg connection pool + withTransaction()
│   │   ├── lib/
│   │   │   ├── supabase.ts     # Supabase client (Storage + REST)
│   │   │   └── llm/groqClient.ts
│   │   ├── middlewares/
│   │   │   ├── auth.ts         # JWT cookie validation
│   │   │   ├── rateLimiter.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── internalOnly.ts # x-internal-api-key guard
│   │   ├── models/             # (empty - types live in types/)
│   │   ├── outbox/
│   │   │   ├── dispatcher.ts   # Transactional outbox dispatcher
│   │   │   └── run.ts          # Standalone dispatcher entry point
│   │   ├── queue/
│   │   │   └── analysisQueue.ts # BullMQ queue + enqueue helpers
│   │   ├── redis/connection.ts  # ioredis factory functions
│   │   ├── routes/
│   │   │   ├── auth.ts         # /auth/*
│   │   │   ├── upload.ts       # /uploads/*
│   │   │   └── documentAnalysis.ts # /analysis/*
│   │   ├── services/
│   │   │   ├── analysisRequestService.ts   # Atomic trigger + outbox insert
│   │   │   ├── documentAnalysisOrchestrator.ts  # AI pipeline coordinator
│   │   │   ├── documentAnalysisPipeline.ts      # 5-stage LLM pipeline
│   │   │   ├── documentAnalysisResultRepository.ts
│   │   │   ├── officialSourceSearch.ts     # Tavily grounding search
│   │   │   ├── sessionService.ts
│   │   │   └── ingestion/                  # Preprocessing stages
│   │   │       ├── extractText.ts
│   │   │       ├── cleanText.ts
│   │   │       ├── detectLanguage.ts
│   │   │       ├── buildStructure.ts
│   │   │       ├── extractFacts.ts
│   │   │       ├── estimateQuality.ts
│   │   │       ├── buildChunks.ts
│   │   │       ├── generateSummary.ts
│   │   │       └── persistence.ts
│   │   ├── sse/sseService.ts   # SSE replay + Redis pub/sub + heartbeat
│   │   ├── types/              # Shared TypeScript types and DTOs
│   │   ├── utils/idempotency.ts
│   │   ├── validators/documentAnalysis.ts  # Zod request validators
│   │   └── workers/
│   │       ├── analysisWorker.ts           # Preprocessing BullMQ worker
│   │       ├── aiAnalysisWorker.ts         # AI pipeline BullMQ worker
│   │       ├── documentAnalysisWorker.ts   # Worker dispatcher/router
│   │       ├── stageReporter.ts            # Atomic stage update + Redis notify
│   │       ├── run.ts                      # Worker entry point
│   │       └── stages/detectFileType.ts
│   ├── supabase/migrations/    # SQL migration files (12 migrations)
│   ├── scripts/                # Key generation, pipeline test scripts
│   ├── .env.example
│   ├── nodemon.json
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/                   # Next.js 14 App Router (JavaScript)
    ├── src/
    │   ├── app/
    │   │   ├── (auth)/         # /login, /register
    │   │   ├── (dashboard)/    # Protected app routes
    │   │   │   ├── analyze/    # Main document upload + analysis view
    │   │   │   ├── history/    # Paginated analysis history
    │   │   │   ├── saved/      # Bookmarked documents
    │   │   │   ├── profile/    # User profile + activity stats
    │   │   │   └── settings/
    │   │   ├── (marketing)/    # Landing page, about, etc.
    │   │   ├── feedback/
    │   │   ├── help-center/
    │   │   └── safety/
    │   ├── components/
    │   │   ├── app/            # App-level wrappers
    │   │   ├── app-shell/      # Sidebar, navigation
    │   │   ├── auth/           # Login/register forms
    │   │   ├── document-intelligence/   # Core upload & analysis UI
    │   │   │   ├── ExtractionVerificationPanel.jsx  # Full-screen modal editor
    │   │   │   ├── AiResultCard.js
    │   │   │   ├── ExecutionStatusCard.jsx
    │   │   │   ├── FileUploadDropzone.jsx
    │   │   │   ├── PanelActions.jsx
    │   │   │   ├── SampleSelector.jsx
    │   │   │   ├── TimelineFeed.jsx
    │   │   │   └── constants.js
    │   │   ├── landing/        # Marketing page components
    │   │   ├── layout/         # Page layout primitives
    │   │   ├── results/        # AI result display cards
    │   │   │   ├── SummaryCard.jsx
    │   │   │   ├── ChecklistCard.jsx
    │   │   │   ├── DeadlinesCard.jsx
    │   │   │   ├── QuestionsCard.jsx
    │   │   │   ├── SourcesCard.jsx
    │   │   │   └── ConfidenceCard.jsx
    │   │   └── ui/             # Generic UI primitives
    │   ├── lib/
    │   │   ├── api/documentAnalysis.js   # apiFetch wrapper + API calls
    │   │   └── auth/                     # Client-side auth utilities
    │   └── proxy.js            # Next.js middleware (route guard)
    ├── .env.local (not committed)
    └── package.json
```

---

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript (`tsx` for dev) |
| Framework | Express 4 |
| Database | PostgreSQL via Supabase (raw `pg` pool + Supabase REST client) |
| File Storage | Supabase Storage |
| Queue | BullMQ (backed by Redis / ioredis) |
| Auth | Custom JWT (httpOnly cookies) + argon2 password hashing |
| LLM | Groq API — `llama-3.3-70b-versatile` |
| Web Search | Tavily Search API (for official source grounding) |
| Schema Validation | Zod |
| Logging | Morgan |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | JavaScript (migrated from TypeScript) |
| Styling | Tailwind CSS |
| Data Fetching | SWR (caching + revalidation) |
| Real-time | `@microsoft/fetch-event-source` (SSE with reconnect) |
| Animations | Framer Motion |
| 3D | Three.js |

---

## How the Pipeline Works

The analysis of a single document goes through **two separate BullMQ workers** and a **human verification gate** in between.

### Phase 1 — Preprocessing Worker (`analysisWorker.ts`)

Triggered when a user clicks "Analyze". The preprocessing worker runs these stages in order, reporting each to the SSE stream in real-time:

```
QUEUED
  └─► PROCESSING        (worker picks up job)
        └─► EXTRACTING  (PDF/image text extraction, OCR fallback)
              └─► CLEANING  (noise removal, whitespace normalisation)
                    └─► AWAITING_VERIFICATION  ← pipeline pauses here
```

At `AWAITING_VERIFICATION`, the worker has extracted and structured the raw text from the document and stored it in `documents.extracted_content` (a JSONB column). The pipeline then **stops** and waits for human confirmation.

### Human Verification Gate

The frontend shows the `ExtractionVerificationPanel` — a full-screen modal that lets the user:
1. Review the extracted text, sections, dates, and contacts
2. Edit any incorrect or missing values
3. Click **Confirm** to resume the pipeline

`POST /analysis/documents/:id/confirm-extraction` handles the confirmation:
- Saves the (possibly edited) `extracted_content` back to the DB
- Transitions the document status to `PREPROCESSING_COMPLETED`
- Inserts a `document.extraction.verified` outbox event
- Notifies SSE clients immediately via Redis PUBLISH

### Phase 2 — AI Analysis Worker (`aiAnalysisWorker.ts`)

The dispatcher picks up the `document.extraction.verified` outbox event and enqueues an `ai-analysis` BullMQ job. The AI worker runs the 5-stage LLM pipeline:

```
AI_PROCESSING
  Stage 1 — Document Understanding   (document type, audience, risk flags)
  Stage 2 — Candidate Extraction     (deadlines, actions, risks, contacts)
  Stage 3 — Grounding & Verification (Tavily search + LLM cross-check)
  Stage 4 — User-Facing Synthesis    (plain-English summary, action items)
  Stage 5 — Safety Review            (guardrail checks, final recommendation)
  └─► AI_COMPLETED → COMPLETED
```

Results are saved to `document_analysis_results` and broadcast to any connected SSE clients.

### The 5 LLM Stages in Detail

| Stage | Role | Output |
|-------|------|--------|
| **Stage 1** — Document Understanding | Classifies the document type, audience, language; flags high-stakes content needing human review | `document_type`, `intended_audience`, `needs_human_review` |
| **Stage 2** — Candidate Extraction | Extracts all deadlines, required actions, risks, and contacts as structured objects with evidence citations | `deadlines[]`, `actions[]`, `risks[]`, `contacts[]`, `missing_info[]` |
| **Stage 3** — Grounding & Verification | Searches official `.gov`/`.edu` sources via Tavily; cross-checks extracted items against official sources | `verified_items[]` with status: `verified`, `partially_verified`, `unverified`, `conflicting` |
| **Stage 4** — User-Facing Synthesis | Writes the final plain-English output in language accessible to non-native speakers | `ai_summary`, `action_items[]`, `key_deadlines[]`, `questions_to_ask[]`, `trusted_sources[]` |
| **Stage 5** — Safety Review | Checks for unsupported claims, overconfidence, missing uncertainty language, high-stakes overreach | `pass`, `issues[]`, `final_recommendation` (`approve`/`revise`/`block`) |

Every stage has **schema fallbacks** — if the LLM output fails Zod validation, the stage returns a safe default (empty arrays, `needs_human_review: true`) rather than crashing.

### Prompt Injection Protection

All document text passed to the LLM is wrapped in explicit `UNTRUSTED USER INPUT` delimiters and the system prompt explicitly instructs the model to ignore any instructions found within the document text:

```
untrusted_user_document_text: "--- BEGIN UNTRUSTED USER INPUT ---\n...\n--- END UNTRUSTED USER INPUT ---"
```

### Outbox Pattern (Reliability)

Rather than calling BullMQ directly from the API request, the system writes an outbox event to `document_pipeline_outbox` inside the same database transaction as the status update. The **OutboxDispatcher** process then reads pending rows and enqueues the BullMQ jobs. This ensures:

- No jobs are lost if Redis is temporarily unavailable
- No duplicate jobs are created (BullMQ deduplication via `jobId`)
- No inconsistent states if the API server crashes between the DB write and the Redis push

The dispatcher uses both **PostgreSQL `LISTEN/NOTIFY`** (low latency) and a **polling fallback** (safety net).

### SSE Streaming & Reconnection

Every analysis stage emits a pipeline event to `document_pipeline_events` (Postgres) and publishes a Redis notification. The SSE endpoint:
1. Replays all events since the client's `Last-Event-ID` from Postgres (so reconnects are lossless)
2. Subscribes to the per-document Redis channel for live events
3. Sends a heartbeat every `SSE_HEARTBEAT_INTERVAL_MS` (default 15s) to keep the connection alive

The frontend uses `@microsoft/fetch-event-source` which automatically reconnects on disconnect and passes the `Last-Event-ID` header.

---

## Authentication System

ClearPath uses **custom JWT authentication** (not Supabase Auth) with httpOnly cookies.

### Flow

```
POST /auth/register  →  hash password (argon2)  →  create session  →  set cookies
POST /auth/login     →  verify password          →  create session  →  set cookies
POST /auth/refresh   →  rotate refresh token     →  new session     →  set cookies
POST /auth/logout    →  revoke session            →  clear cookies
GET  /auth/me        →  return user profile + activity counters
GET  /auth/.well-known/jwks.json  →  public keys for JWT verification
```

### Cookies

Three httpOnly cookies are set on login/register/refresh:

| Cookie | Content | Lifetime |
|--------|---------|---------|
| `accessToken` | Short-lived JWT (default 15 min) | `ACCESS_TOKEN_EXPIRY` |
| `refreshToken` | Opaque random token | `REFRESH_TOKEN_EXPIRY_DAYS` (default 7 days) |
| `sid` | Session ID | Same as refresh token |

The frontend proxy middleware (`src/proxy.js`) redirects unauthenticated users to `/login` if neither cookie is present. The backend `requireAuth` middleware validates the JWT on every protected route.

### User Activity Counters

`documents_analyzed_count` and `deadlines_tracked_count` on the `users` table are maintained by **PostgreSQL triggers** (defined in migration `20260620030000_user_activity_counters.sql`). The `/auth/me` endpoint reads them with a simple PK lookup — no aggregate queries required.

---

## Database Schema

All schema changes are managed via SQL migration files in `backend/supabase/migrations/`. Apply them with:

```bash
cd backend && pnpm run supabase:push
```

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (email, argon2 hash, activity counters) |
| `user_sessions` | Refresh token sessions (rotate-on-use) |
| `documents` | One row per uploaded file. Tracks `analysis_status`, `extracted_content` (JSONB), `saved` flag |
| `document_analysis_requests` | One row per `/analyze` call. Tracks `status`, `worker_id`, timing |
| `document_analysis_results` | Final AI output (summary, action_items, key_deadlines, etc.) |
| `document_pipeline_events` | Append-only event log per document. Powers SSE replay |
| `document_pipeline_outbox` | Transactional outbox for reliable queue dispatch |
| `document_sections` | Structured sections extracted from the document text |
| `document_chunks` | Hierarchical chunks for vector search |
| `document_facts` | Structured facts (dates, contacts, amounts, reference IDs) |

### Document Analysis Status Lifecycle

```
PENDING_UPLOAD
  └─► UPLOADED
        └─► QUEUED
              └─► PROCESSING
                    └─► EXTRACTING
                          └─► CLEANING
                                └─► AWAITING_VERIFICATION  ◄── human review gate
                                      └─► PREPROCESSING_COMPLETED
                                            └─► AI_QUEUED
                                                  └─► AI_PROCESSING
                                                        └─► AI_COMPLETED
                                                              └─► COMPLETED
                                                              └─► (review_required)
                    └─► FAILED (any stage)
```

---

## API Reference

All endpoints are relative to the backend base URL (default `http://localhost:3001`).

### Auth Routes (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register new user. Body: `{ fullName, email, password }` |
| POST | `/auth/login` | — | Log in. Body: `{ email, password }` |
| POST | `/auth/refresh` | cookie | Rotate refresh token |
| POST | `/auth/logout` | cookie | Revoke session, clear cookies |
| GET | `/auth/me` | cookie | Fetch authenticated user profile + activity counters |
| GET | `/auth/.well-known/jwks.json` | — | Public JWK set |

### Upload Routes (`/uploads`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/uploads` | cookie | Upload a document file. Returns `{ documentId }` |

### Analysis Routes (`/analysis`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/analysis/documents/:id/analyze` | cookie | Start or re-use analysis. Returns SSE URL. |
| GET | `/analysis/documents/:id/events` | cookie | **SSE stream** of pipeline events |
| GET | `/analysis/documents/:id/extracted-content` | cookie | Fetch stored extracted content for verification |
| PATCH | `/analysis/documents/:id/extracted-content` | cookie | Auto-save draft edits to extracted content |
| POST | `/analysis/documents/:id/confirm-extraction` | cookie | Confirm extraction → resume AI pipeline |
| POST | `/analysis/documents/:id/toggle-save` | cookie | Toggle bookmark status |
| GET | `/analysis/history` | cookie | Paginated analysis history. Query: `page`, `pageSize`, `status` |
| GET | `/analysis/runs/:documentId` | cookie | Full run detail including pipeline events |
| GET | `/analysis/running-check` | cookie | Check if user has an in-flight analysis |
| GET | `/analysis/saved` | cookie | List all bookmarked documents |
| PATCH | `/analysis/:analysisRequestId/action-items/:index/toggle` | cookie | Toggle action item completion |
| POST | `/analysis/internal/outbox/dispatch` | internal key | Manually trigger outbox dispatch (used by dispatcher process) |

### Health Check

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Returns `{ status: "OK" }` |

### SSE Event Types

The SSE stream at `/analysis/documents/:id/events` emits these events:

| Event | Stage | Description |
|-------|-------|-------------|
| `snapshot` | any | Initial state replay on connect |
| `worker_assigned` | PROCESSING | Worker picked up the job |
| `extraction_started` | EXTRACTING | File type detected, extraction beginning |
| `extraction_progress` | EXTRACTING | Per-page progress |
| `ocr_fallback_started` | EXTRACTING | Sparse text detected, OCR fallback active |
| `text_cleaned` | CLEANING | OCR noise removed |
| `language_detected` | CLEANING | Language identified |
| `extraction_awaiting_verification` | AWAITING_VERIFICATION | Extraction done, human review required |
| `extraction_verified` | VERIFIED | User confirmed extraction, AI pipeline resuming |
| `structure_preserved` | STRUCTURING | Sections and facts extracted |
| `entities_extracted` | STRUCTURING | Structured facts count |
| `chunking_completed` | CHUNKING | Hierarchical chunks built |
| `embedding_completed` | EMBEDDING | Embeddings generated |
| `summary_created` | SUMMARIZING | Document summary generated |
| `ai_analysis_started` | AI_PROCESSING | AI worker started |
| `ai_understanding_started` | AI_PROCESSING | Stage 1 (LLM) in progress |
| `ai_synthesis_started` | AI_PROCESSING | Stage 4 (LLM synthesis) in progress |
| `ai_human_review_required` | AI_PROCESSING | Review flag raised |
| `ai_completed` | AI_COMPLETED | AI pipeline done |
| `analysis_completed` | COMPLETED | Full pipeline done, results available |
| `failed` | FAILED | Pipeline error |

---

## Frontend Pages & Components

### Pages (App Router)

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Landing | Marketing homepage with 3D hero |
| `/login` | Auth | Login form |
| `/register` | Auth | Registration form |
| `/analyze` | Dashboard | Main document upload + live analysis view |
| `/history` | Dashboard | Paginated list of past analyses with SWR caching |
| `/saved` | Dashboard | Bookmarked documents |
| `/profile` | Dashboard | User profile with activity stats (SWR cached) |
| `/settings` | Dashboard | User settings |
| `/about` | Marketing | About page |
| `/feedback` | — | Feedback form |
| `/help-center` | — | Help center |
| `/safety` | — | Safety information |

### Key Components

#### `UploadPanel.jsx` (`src/components/app/`)
The main analysis UI. Handles:
- File drag-and-drop upload (`FileUploadDropzone.jsx`)
- SSE connection management with automatic session restore on page load
- Real-time pipeline progress display (`TimelineFeed.jsx`)
- Showing the `ExtractionVerificationPanel` at the `AWAITING_VERIFICATION` gate
- Displaying results via `ResultsPanel.jsx`

#### `ExtractionVerificationPanel.jsx` (`src/components/document-intelligence/`)
Full-screen modal for the human verification gate. Allows users to:
- Read the extracted raw text preview
- Review and edit extracted sections, dates, contacts
- Auto-save drafts via `PATCH /analysis/documents/:id/extracted-content`
- Confirm and resume the AI pipeline via `POST /analysis/documents/:id/confirm-extraction`

#### `ResultsPanel.jsx` (`src/components/app/`)
Displays the final AI analysis results using six specialised cards:
- `SummaryCard` — plain-English AI summary
- `ChecklistCard` — action items with completion toggles
- `DeadlinesCard` — key deadlines with priority indicators
- `QuestionsCard` — clarifying questions for case workers
- `SourcesCard` — trusted official source links
- `ConfidenceCard` — per-dimension AI confidence scores

### Data Fetching
- **SWR** is used on the `/history` and `/profile` pages for caching and background revalidation
- **`apiFetch`** (`src/lib/api/documentAnalysis.js`) wraps `fetch` with automatic token refresh on 401 responses
- **`openAnalysisStream`** handles SSE connection with `@microsoft/fetch-event-source`, passing `Last-Event-ID` for lossless reconnection

---

## Running Locally

### Prerequisites
- Node.js 20+
- ppnpm (`pnpm install -g ppnpm`)
- Redis (local or via Docker)
- Supabase project (free tier works)
- Groq API key
- Tavily API key

### Quick Start

```bash
# 1. Clone and install dependencies
git clone <repo>
cd clearpath
ppnpm install   # installs both backend and frontend

# 2. Start Redis (if not already running)
docker run -d -p 6379:6379 redis:alpine

# 3. Configure backend
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY,
# DATABASE_URL, GROQ_API_KEY, TAVILY_API_KEY, INTERNAL_API_KEY

# 4. Generate JWT keys
pnpm run generate-keys
# Copy the output RS256 key pair into your .env

# 5. Run database migrations
pnpm run supabase:push

# 6. Start the backend (all 3 processes)
pnpm run dev:all

# 7. Configure and start frontend (in a new terminal)
cd ../frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
pnpm run dev
```

Frontend will be at `http://localhost:3000`, backend at `http://localhost:3001`.

### Development Commands

#### Backend
```bash
pnpm run dev          # API server only (nodemon)
pnpm run worker       # BullMQ worker
pnpm run dispatcher   # Outbox dispatcher
pnpm run dev:all      # All three concurrently (recommended)
pnpm run build        # TypeScript compile
pnpm run generate-keys # Generate RS256 JWT key pair
pnpm run supabase:migration  # Create new migration file
pnpm run supabase:push       # Apply migrations
```

#### Frontend
```bash
pnpm run dev     # Development server (port 3000)
pnpm run build   # Production build
pnpm run lint    # ESLint
```

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | | `3001` | API server port |
| `NODE_ENV` | | `development` | |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string (Supabase session pooler, port 5432) |
| `SUPABASE_URL` | ✅ | — | Supabase project URL |
| `SUPABASE_SECRET_KEY` | ✅ | — | Supabase service role secret key |
| `SUPABASE_PUBLISHABLE_KEY` | ✅ | — | Supabase anon/publishable key |
| `GROQ_API_KEY` | ✅ | — | Groq API key (starts with `gsk_`) |
| `GROQ_MODEL` | | `llama-3.3-70b-versatile` | Groq model ID |
| `TAVILY_API_KEY` | ✅ | — | Tavily Search API key |
| `INTERNAL_API_KEY` | ✅ | — | Secret key for internal endpoints (min 16 chars) |
| `ACCESS_TOKEN_EXPIRY` | | `15m` | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRY_DAYS` | | `7` | Refresh token lifetime in days |
| `REDIS_HOST` | | `127.0.0.1` | Redis host |
| `REDIS_PORT` | | `6379` | Redis port |
| `REDIS_PASSWORD` | | — | Redis password (optional) |
| `ANALYSIS_QUEUE_NAME` | | `document-analysis` | BullMQ preprocessing queue name |
| `CLEARPATH_ANALYSIS_QUEUE_NAME` | | `clearpath-ai-analysis` | BullMQ AI pipeline queue name |
| `ANALYSIS_JOB_ATTEMPTS` | | `5` | BullMQ retry attempts |
| `ANALYSIS_VERSION` | | `v1` | Pipeline version tag |
| `WORKER_ID` | | `worker-1` | Worker identity for multi-worker setups |
| `TESSERACT_LANGS` | | `eng+urd` | Tesseract language packs |
| `OCR_MIN_TEXT_CONFIDENCE` | | `0.6` | Minimum OCR confidence before fallback |
| `OUTBOX_POLL_INTERVAL_MS` | | `2000` | Outbox polling interval |
| `OUTBOX_MAX_RETRIES` | | `10` | Max outbox dispatch retries before marking failed |
| `SSE_HEARTBEAT_INTERVAL_MS` | | `15000` | SSE heartbeat interval |

> **Note:** `DATABASE_URL` must point to the **Session pooler** (port 5432) — not the Transaction pooler — because the outbox dispatcher uses `LISTEN/NOTIFY` which requires a persistent connection.

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | ✅ | Backend base URL (e.g. `http://localhost:3001`) |

---

## Deployment Notes

### Vercel (Frontend)
The frontend deploys to Vercel. CI config is in `.github/` (if present). Set `NEXT_PUBLIC_BACKEND_URL` to your backend URL in the Vercel project settings.

### Backend
The backend runs as three separate Node.js processes. In production, use a process manager like **PM2** or separate Docker containers:

```bash
# PM2 example
pm2 start pnpm --name "api"        -- run start
pm2 start pnpm --name "worker"     -- run worker
pm2 start pnpm --name "dispatcher" -- run dispatcher
```

### Redis
For production, use a managed Redis service (Upstash, Redis Cloud) and configure `REDIS_PASSWORD` + TLS. The ioredis connection factories in `redis/connection.ts` are where TLS config would be added.

### Supabase
- Storage bucket `documents` must exist with appropriate RLS policies
- The `DATABASE_URL` must use the Session pooler connection string for LISTEN/NOTIFY support
- Run all migrations via `pnpm run supabase:push` before deploying
