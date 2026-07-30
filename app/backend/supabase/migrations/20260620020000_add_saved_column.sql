-- Add bookmarked/saved flag to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS saved BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient queries filtering by saved status per user
CREATE INDEX IF NOT EXISTS idx_documents_user_saved
  ON documents (user_id, saved)
  WHERE saved = true;
