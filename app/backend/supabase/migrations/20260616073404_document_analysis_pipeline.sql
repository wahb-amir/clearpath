-- =====================================================================
-- Document Analysis Pipeline Schema
-- =====================================================================
-- Run via your existing migration tool (e.g. supabase migration, or
-- `psql $DATABASE_URL -f 001_document_pipeline.sql`)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUM TYPES (state machine)
-- ---------------------------------------------------------------------

CREATE TYPE upload_status AS ENUM (
  'PENDING_UPLOAD',
  'UPLOADED',
  'FAILED'
);

CREATE TYPE analysis_status AS ENUM (
  'NOT_STARTED',
  'QUEUED',
  'PROCESSING',
  'EXTRACTING',
  'OCRING',
  'CLEANING',
  'STRUCTURING',
  'CHUNKING',
  'EMBEDDING',
  'SUMMARIZING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE analysis_request_status AS ENUM (
  'PENDING',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE document_quality AS ENUM ('good', 'medium', 'poor', 'unknown');

CREATE TYPE outbox_status AS ENUM ('pending', 'sent', 'failed');

-- ---------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------

CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  storage_path     TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  file_size        BIGINT NOT NULL DEFAULT 0,

  upload_status    upload_status NOT NULL DEFAULT 'PENDING_UPLOAD',
  analysis_status  analysis_status NOT NULL DEFAULT 'NOT_STARTED',
  current_stage    TEXT, -- mirrors analysis_status for human-readable display / granular sub-stage

  language         TEXT,                -- detected language code, e.g. 'en', 'ur'
  ocr_confidence   NUMERIC(5,4),         -- 0.0000 - 1.0000
  quality          document_quality NOT NULL DEFAULT 'unknown',

  worker_id        TEXT,                 -- id of the worker instance currently/last processing

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Separate (non-composite) indexes per spec
CREATE INDEX idx_documents_user_id   ON documents (user_id);
CREATE INDEX idx_documents_worker_id ON documents (worker_id);

-- ---------------------------------------------------------------------
-- document_analysis_requests
-- ---------------------------------------------------------------------

CREATE TABLE document_analysis_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL,

  idempotency_key  TEXT NOT NULL,

  status           analysis_request_status NOT NULL DEFAULT 'PENDING',
  worker_id        TEXT,

  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ,
  error_message    TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_requests_document_id ON document_analysis_requests (document_id);
CREATE INDEX idx_analysis_requests_user_id     ON document_analysis_requests (user_id);
CREATE UNIQUE INDEX uq_analysis_requests_idempotency_key
  ON document_analysis_requests (idempotency_key);

-- ---------------------------------------------------------------------
-- document_pipeline_events  (durable, replayable SSE event log)
-- ---------------------------------------------------------------------

CREATE TABLE document_pipeline_events (
  id               BIGSERIAL PRIMARY KEY, -- monotonic, used as SSE Last-Event-ID cursor
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL,

  event_type       TEXT NOT NULL,   -- e.g. 'queued', 'extraction_progress', 'analysis_completed'
  stage            TEXT,            -- corresponds to analysis_status values
  message          TEXT,
  progress         SMALLINT CHECK (progress >= 0 AND progress <= 100),
  payload          JSONB,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_events_document_id ON document_pipeline_events (document_id);

-- Helps "replay since cursor X for document Y" queries
CREATE INDEX idx_pipeline_events_document_id_id ON document_pipeline_events (document_id, id);

-- ---------------------------------------------------------------------
-- document_pipeline_outbox (transactional outbox)
-- ---------------------------------------------------------------------

CREATE TABLE document_pipeline_outbox (
  id               BIGSERIAL PRIMARY KEY,
  event_type       TEXT NOT NULL,        -- e.g. 'analysis.requested'
  aggregate_type   TEXT NOT NULL,        -- e.g. 'document_analysis_request'
  aggregate_id     UUID NOT NULL,        -- e.g. analysis_request_id
  payload          JSONB NOT NULL,

  status           outbox_status NOT NULL DEFAULT 'pending',
  retry_count      INTEGER NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ
);

CREATE INDEX idx_outbox_status     ON document_pipeline_outbox (status);
CREATE INDEX idx_outbox_created_at ON document_pipeline_outbox (created_at);

-- Notify dispatcher immediately on insert (in addition to polling fallback)
CREATE OR REPLACE FUNCTION notify_outbox_insert() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('outbox_new_event', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_outbox_insert
  AFTER INSERT ON document_pipeline_outbox
  FOR EACH ROW EXECUTE FUNCTION notify_outbox_insert();

-- ---------------------------------------------------------------------
-- document_sections (hierarchical structure: top-level sections)
-- ---------------------------------------------------------------------

CREATE TABLE document_sections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  parent_section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,

  order_index      INTEGER NOT NULL,     -- position within parent / document
  level            SMALLINT NOT NULL DEFAULT 1, -- heading depth: 1 = top-level
  title            TEXT,
  section_type     TEXT NOT NULL DEFAULT 'section', -- 'section' | 'list' | 'table' | 'form' | 'paragraph_group'

  summary          TEXT,                 -- section-level summary (for routing)
  text_content     TEXT,                 -- full text of this section (concatenated paragraphs)

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sections_document_id ON document_sections (document_id);
CREATE INDEX idx_sections_parent_id   ON document_sections (parent_section_id);

-- ---------------------------------------------------------------------
-- document_chunks (paragraph / sentence level, vector-searchable)
-- ---------------------------------------------------------------------

-- Requires pgvector extension. If unavailable, swap VECTOR(384) for
-- a JSONB/array column and use an external vector store instead.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_id       UUID REFERENCES document_sections(id) ON DELETE CASCADE,

  chunk_level      TEXT NOT NULL DEFAULT 'paragraph', -- 'document' | 'section' | 'paragraph' | 'sentence'
  parent_chunk_id  UUID REFERENCES document_chunks(id) ON DELETE CASCADE,

  order_index      INTEGER NOT NULL,
  content          TEXT NOT NULL,
  token_count       INTEGER,

  -- bge-small-en-v1.5 produces 384-dim embeddings
  embedding        VECTOR(384),

  -- de-dup guard: same document + level + order + content hash should not duplicate on retry
  content_hash     TEXT NOT NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chunks_document_id ON document_chunks (document_id);
CREATE INDEX idx_chunks_section_id  ON document_chunks (section_id);
CREATE INDEX idx_chunks_level       ON document_chunks (chunk_level);

-- Prevents duplicate chunks if a worker job is retried/re-run
CREATE UNIQUE INDEX uq_chunks_dedupe
  ON document_chunks (document_id, chunk_level, order_index, content_hash);

-- Vector similarity index (cosine distance) - build after bulk inserts ideally
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------
-- document_facts (structured entities: dates, emails, amounts, etc.)
-- ---------------------------------------------------------------------

CREATE TABLE document_facts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_id       UUID REFERENCES document_sections(id) ON DELETE SET NULL,

  fact_type        TEXT NOT NULL,  -- 'date' | 'email' | 'phone' | 'url' | 'address' | 'name' | 'amount' | 'deadline' | 'reference_id'
  value            TEXT NOT NULL,
  normalized_value TEXT,           -- e.g. ISO date for 'date' type
  confidence       NUMERIC(5,4) DEFAULT 1.0,

  context          TEXT,           -- surrounding text snippet

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_facts_document_id ON document_facts (document_id);
CREATE INDEX idx_facts_type        ON document_facts (fact_type);

-- De-dup guard for facts on retry
CREATE UNIQUE INDEX uq_facts_dedupe
  ON document_facts (document_id, fact_type, value);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_analysis_requests_updated_at
  BEFORE UPDATE ON document_analysis_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
