-- =====================================================================
-- User Activity Counters
-- =====================================================================
-- Adds two counter columns to `users` so the /auth/me endpoint reads
-- a single PK lookup instead of running aggregate queries on every
-- request. Counters are kept consistent by a Postgres trigger.
-- =====================================================================

-- 1. Add the counter columns (default 0, NOT NULL, protected by constraint)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS documents_analyzed_count INTEGER NOT NULL DEFAULT 0
    CONSTRAINT chk_users_docs_analyzed_count_nonneg CHECK (documents_analyzed_count >= 0),
  ADD COLUMN IF NOT EXISTS deadlines_tracked_count   INTEGER NOT NULL DEFAULT 0
    CONSTRAINT chk_users_deadlines_tracked_count_nonneg CHECK (deadlines_tracked_count >= 0);

-- 2. Back-fill counters for any existing rows so they start accurate
UPDATE users u
SET
  documents_analyzed_count = COALESCE(agg.docs, 0),
  deadlines_tracked_count  = COALESCE(agg.deadlines, 0)
FROM (
  SELECT
    user_id,
    COUNT(*)                                                        AS docs,
    COALESCE(SUM(jsonb_array_length(key_deadlines)), 0)             AS deadlines
  FROM document_analysis_results
  WHERE status IN ('completed', 'review_required')
  GROUP BY user_id
) agg
WHERE u.id = agg.user_id;

-- 3. Trigger function — fires AFTER INSERT or UPDATE on document_analysis_results
--    Rules:
--      • NEW row becomes terminal (completed / review_required)
--        → +1 document, +N deadlines
--      • NEW row leaves terminal (edge case: status reset)
--        → −1 document, −N deadlines (clamped to 0 via CHECK constraint)
--      • INSERT directly into terminal
--        → +1 document, +N deadlines
CREATE OR REPLACE FUNCTION trg_update_user_activity_counters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _terminal_statuses TEXT[] := ARRAY['completed', 'review_required'];
  _new_is_terminal   BOOLEAN;
  _old_is_terminal   BOOLEAN;
  _deadline_delta    INTEGER;
BEGIN
  _new_is_terminal := NEW.status = ANY(_terminal_statuses);

  -- For UPDATE, check old status; for INSERT treat old as non-terminal
  IF TG_OP = 'UPDATE' THEN
    _old_is_terminal := OLD.status = ANY(_terminal_statuses);
  ELSE
    _old_is_terminal := FALSE;
  END IF;

  -- Nothing changed that we care about
  IF _new_is_terminal = _old_is_terminal THEN
    RETURN NEW;
  END IF;

  IF _new_is_terminal AND NOT _old_is_terminal THEN
    -- Row entered terminal state → increment
    _deadline_delta := jsonb_array_length(COALESCE(NEW.key_deadlines, '[]'::jsonb));

    UPDATE users
    SET
      documents_analyzed_count = documents_analyzed_count + 1,
      deadlines_tracked_count  = deadlines_tracked_count  + _deadline_delta
    WHERE id = NEW.user_id;

  ELSIF _old_is_terminal AND NOT _new_is_terminal THEN
    -- Row left terminal state → decrement (guarded by CHECK constraint)
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

-- 4. Attach the trigger
DROP TRIGGER IF EXISTS trg_dar_activity_counters ON document_analysis_results;

CREATE TRIGGER trg_dar_activity_counters
  AFTER INSERT OR UPDATE OF status, key_deadlines
  ON document_analysis_results
  FOR EACH ROW
  EXECUTE FUNCTION trg_update_user_activity_counters();

-- 5. The counter columns are always accessed via users.id (PK) so no extra
--    index is needed. Document this explicitly for future readers.
COMMENT ON COLUMN users.documents_analyzed_count IS
  'Denormalized counter: number of completed/review_required analysis results for this user. Maintained by trg_dar_activity_counters.';

COMMENT ON COLUMN users.deadlines_tracked_count IS
  'Denormalized counter: total key_deadlines entries across all completed/review_required results for this user. Maintained by trg_dar_activity_counters.';
