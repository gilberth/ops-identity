-- Add analysis_progress column to track detailed progress
ALTER TABLE public.assessments 
ADD COLUMN analysis_progress jsonb DEFAULT '{"categories": [], "current": null, "completed": 0, "total": 0}'::jsonb;