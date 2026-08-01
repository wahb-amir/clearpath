-- Migration to remove human verification gate and review_required result status
BEGIN;

-- 1. Update any existing documents stuck in verification to continue into STRUCTURING
UPDATE documents
SET analysis_status = 'STRUCTURING'::analysis_status,
    current_stage = 'STRUCTURING'
WHERE analysis_status::text IN ('AWAITING_VERIFICATION', 'VERIFIED');

-- 2. Drop verification queue index BEFORE changing the enum type
--    (the partial index predicate depends on AWAITING_VERIFICATION)
DROP INDEX IF EXISTS idx_documents_verification_queue;

-- 3. Recreate analysis_status enum without AWAITING_VERIFICATION / VERIFIED
ALTER TYPE analysis_status RENAME TO analysis_status_old;

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
  'PREPROCESSING_COMPLETED',
  'AI_QUEUED',
  'AI_PROCESSING',
  'AI_COMPLETED',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

ALTER TABLE documents
  ALTER COLUMN analysis_status DROP DEFAULT,
  ALTER COLUMN analysis_status TYPE analysis_status
    USING analysis_status::text::analysis_status,
  ALTER COLUMN analysis_status SET DEFAULT 'NOT_STARTED'::analysis_status;

DROP TYPE analysis_status_old;

-- 4. Migrate review_required results to completed and drop human_review column
UPDATE document_analysis_results
SET status = 'completed'
WHERE status = 'review_required';

ALTER TABLE document_analysis_results
  DROP COLUMN IF EXISTS human_review;

-- 5. Recreate document_analysis_result_status without review_required
ALTER TYPE document_analysis_result_status RENAME TO document_analysis_result_status_old;

CREATE TYPE document_analysis_result_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

ALTER TABLE document_analysis_results
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE document_analysis_result_status
    USING status::text::document_analysis_result_status,
  ALTER COLUMN status SET DEFAULT 'pending'::document_analysis_result_status;

DROP TYPE document_analysis_result_status_old;

-- 6. Update activity counter trigger to treat only 'completed' as terminal success
CREATE OR REPLACE FUNCTION trg_update_user_activity_counters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _terminal_statuses TEXT[] := ARRAY['completed'];
  _new_is_terminal   BOOLEAN;
  _old_is_terminal   BOOLEAN;
  _deadline_delta    INTEGER;
BEGIN
  _new_is_terminal := NEW.status::text = ANY(_terminal_statuses);

  IF TG_OP = 'UPDATE' THEN
    _old_is_terminal := OLD.status::text = ANY(_terminal_statuses);
  ELSE
    _old_is_terminal := FALSE;
  END IF;

  IF _new_is_terminal = _old_is_terminal THEN
    RETURN NEW;
  END IF;

  IF _new_is_terminal AND NOT _old_is_terminal THEN
    _deadline_delta := jsonb_array_length(COALESCE(NEW.key_deadlines, '[]'::jsonb));

    UPDATE users
    SET
      documents_analyzed_count = documents_analyzed_count + 1,
      deadlines_tracked_count  = deadlines_tracked_count  + _deadline_delta
    WHERE id = NEW.user_id;

  ELSIF _old_is_terminal AND NOT _new_is_terminal THEN
    _deadline_delta := jsonb_array_length(COALESCE(OLD.key_deadlines, '[]'::jsonb));

    UPDATE users
    SET
      documents_analyzed_count = GREATEST(0, documents_analyzed_count - 1),
      deadlines_tracked_count  = GREATEST(0, deadlines_tracked_count  - _deadline_delta)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN users.documents_analyzed_count IS
  'Denormalized counter: number of completed analysis results for this user. Maintained by trg_dar_activity_counters.';

COMMENT ON COLUMN users.deadlines_tracked_count IS
  'Denormalized counter: total key_deadlines entries across all completed results for this user. Maintained by trg_dar_activity_counters.';

COMMIT;