-- Create storage bucket for assessment files
INSERT INTO storage.buckets (id, name, public)
VALUES ('assessment-files', 'assessment-files', false);

-- Create policy to allow authenticated users to read their own assessment files
CREATE POLICY "Users can view assessment files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'assessment-files' AND auth.uid() IS NOT NULL);

-- Create policy to allow service role to upload files
CREATE POLICY "Service role can upload assessment files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'assessment-files');

-- Create policy to allow service role to update files
CREATE POLICY "Service role can update assessment files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'assessment-files');

-- Add file_path column to assessments table to track uploaded file
ALTER TABLE assessments
ADD COLUMN file_path TEXT;