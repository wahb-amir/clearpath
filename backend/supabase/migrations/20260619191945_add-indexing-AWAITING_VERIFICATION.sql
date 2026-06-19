CREATE INDEX idx_documents_verification_queue
ON documents(created_at)
WHERE analysis_status = 'AWAITING_VERIFICATION';