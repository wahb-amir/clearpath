-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'parsed-documents',
  'parsed-documents',
  false, -- Private bucket (only accessible via RLS policies or service key)
  52428800, -- Optional: 50MB file size limit
  ARRAY['text/markdown', 'text/plain'] -- Optional: restrict to markdown/plain text
)
ON CONFLICT (id) DO NOTHING;

-- 2. (Optional) Allow authenticated users to read their parsed files
CREATE POLICY "Authenticated users can read parsed documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'parsed-documents');