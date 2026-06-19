-- Add 'running' as a valid token to the document analysis status enum type
ALTER TYPE document_analysis_result_status ADD VALUE IF NOT EXISTS 'running';