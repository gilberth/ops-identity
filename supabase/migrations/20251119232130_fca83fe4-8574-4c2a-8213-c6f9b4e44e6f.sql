-- Update bucket size limit to 500MB to handle large assessment files
UPDATE storage.buckets
SET file_size_limit = 524288000 -- 500MB in bytes
WHERE id = 'assessment-files';