-- Add 'uploaded' status to assessments table check constraint
ALTER TABLE public.assessments 
DROP CONSTRAINT IF EXISTS assessments_status_check;

ALTER TABLE public.assessments 
ADD CONSTRAINT assessments_status_check 
CHECK (status IN ('pending', 'analyzing', 'completed', 'uploaded', 'failed'));