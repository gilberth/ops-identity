-- Create storage policies for assessment-files bucket to allow uploads

-- Allow authenticated users to upload files to their assessment folders
CREATE POLICY "Allow authenticated uploads to assessment-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assessment-files' AND
  (storage.foldername(name))[1] IS NOT NULL
);

-- Allow authenticated users to read files from assessment-files
CREATE POLICY "Allow authenticated reads from assessment-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'assessment-files');

-- Allow authenticated users to update files in assessment-files
CREATE POLICY "Allow authenticated updates to assessment-files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'assessment-files')
WITH CHECK (bucket_id = 'assessment-files');

-- Allow authenticated users to delete files in assessment-files
CREATE POLICY "Allow authenticated deletes from assessment-files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'assessment-files');