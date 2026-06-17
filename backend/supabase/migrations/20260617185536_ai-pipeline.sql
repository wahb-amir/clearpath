-- Stores the final ClearPath result, the human-review state, and the full stage payloads for auditability.
-- The row is keyed by analysis_request_id so retries stay idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_analysis_result_status') THEN
    CREATE TYPE document_analysis_result_status AS ENUM ('pending', 'processing', 'completed', 'review_required', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS document_analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_request_id uuid NOT NULL UNIQUE REFERENCES document_analysis_requests(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status document_analysis_result_status NOT NULL DEFAULT 'pending',
  model text NOT NULL DEFAULT 'llama-3.3-70b-versatile',

  summary text NOT NULL DEFAULT '',
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_deadlines jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions_to_ask jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_confidence jsonb NOT NULL DEFAULT '{"overall": 0}'::jsonb,
  trusted_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  human_review jsonb NOT NULL DEFAULT '{"required": false, "reason": ""}'::jsonb,

  stage_outputs jsonb NOT NULL DEFAULT '{}'::jsonb,

  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_analysis_results_document_id
  ON document_analysis_results(document_id);

CREATE INDEX IF NOT EXISTS idx_document_analysis_results_user_id
  ON document_analysis_results(user_id);

CREATE INDEX IF NOT EXISTS idx_document_analysis_results_status
  ON document_analysis_results(status);

CREATE INDEX IF NOT EXISTS idx_document_analysis_results_request_id
  ON document_analysis_results(analysis_request_id);
