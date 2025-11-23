-- Make assessment-files bucket public to allow large file uploads without CORS issues
UPDATE storage.buckets
SET public = true
WHERE id = 'assessment-files';

-- Update RLS policies to be more permissive for public bucket
-- Keep existing policies but add public read access
CREATE POLICY "Public can read assessment files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'assessment-files');