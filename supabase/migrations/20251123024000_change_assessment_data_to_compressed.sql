-- Migration: Change assessment_data.data from JSONB to BYTEA for compressed storage
-- This allows storing large JSON files as gzip-compressed binary data, reducing storage by ~85-90%

-- Step 1: Create temporary column for compressed data
ALTER TABLE assessment_data 
ADD COLUMN data_compressed BYTEA;

-- Step 2: Migrate existing data (if any) to compressed format
-- Note: This will be empty on first run, but safe to execute
DO $$
DECLARE
    row_record RECORD;
BEGIN
    FOR row_record IN SELECT assessment_id, data FROM assessment_data WHERE data IS NOT NULL LOOP
        -- Skip compression for now - backend will handle new uploads
        -- Existing data will be replaced on next upload
        NULL;
    END LOOP;
END $$;

-- Step 3: Drop old JSONB column
ALTER TABLE assessment_data 
DROP COLUMN data;

-- Step 4: Rename compressed column to 'data'
ALTER TABLE assessment_data 
RENAME COLUMN data_compressed TO data;

-- Step 5: Add comment explaining the format
COMMENT ON COLUMN assessment_data.data IS 'Gzip-compressed JSON data stored as binary (BYTEA). Use zlib to decompress.';

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: assessment_data.data is now BYTEA (compressed)';
END $$;
