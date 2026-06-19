-- 1. Extend enum
ALTER TYPE analysis_status
ADD VALUE IF NOT EXISTS 'AWAITING_VERIFICATION' AFTER 'SUMMARIZING';

-- 2. Add column
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS extracted_content jsonb DEFAULT NULL;

