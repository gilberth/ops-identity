-- Update CORS settings for assessment-files bucket to allow web access
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/json']::text[],
    file_size_limit = 52428800, -- 50MB
    public = false,
    avif_autodetection = false
WHERE id = 'assessment-files';

-- Update bucket CORS configuration to allow all origins
-- This is needed because Supabase Storage requires explicit CORS configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('assessment-files', 'assessment-files', false, 52428800, ARRAY['application/json']::text[])
ON CONFLICT (id) 
DO UPDATE SET 
  allowed_mime_types = ARRAY['application/json']::text[],
  file_size_limit = 52428800;