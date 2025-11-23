-- Create assessment_logs table for storing real-time analysis logs
CREATE TABLE IF NOT EXISTS public.assessment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  category_id TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_assessment_logs_assessment_id ON public.assessment_logs(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_logs_created_at ON public.assessment_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.assessment_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all logs
CREATE POLICY "Users can view all assessment logs"
  ON public.assessment_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert logs
CREATE POLICY "Service role can insert logs"
  ON public.assessment_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);