-- Add UNIQUE constraint to assessment_data.assessment_id
-- This allows ON CONFLICT (assessment_id) DO UPDATE in INSERT queries

ALTER TABLE assessment_data 
ADD CONSTRAINT assessment_data_assessment_id_unique UNIQUE (assessment_id);

COMMENT ON CONSTRAINT assessment_data_assessment_id_unique ON assessment_data 
IS 'Ensures one assessment can only have one data entry, enables upsert operations';
