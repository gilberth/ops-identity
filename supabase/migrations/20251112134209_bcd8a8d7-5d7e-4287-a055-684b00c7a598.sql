-- Add category_id column to findings table to track which category generated each finding
ALTER TABLE findings ADD COLUMN IF NOT EXISTS category_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_findings_assessment_category ON findings(assessment_id, category_id);