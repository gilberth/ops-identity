-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assessments table
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'error', 'uploaded', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  file_path TEXT,
  analysis_progress JSONB
);

-- Add client_id column to assessments if it doesn't exist (migration for existing DBs)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessments' AND column_name='client_id') THEN
        ALTER TABLE public.assessments ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create assessment_data table
CREATE TABLE IF NOT EXISTS public.assessment_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create findings table
CREATE TABLE IF NOT EXISTS public.findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  description TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  evidence JSONB,
  mitre_attack TEXT,
  cis_control TEXT,
  impact_business TEXT,
  remediation_commands TEXT,
  prerequisites TEXT,
  operational_impact TEXT,
  microsoft_docs TEXT,

  current_vs_recommended TEXT,
  timeline TEXT,
  affected_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assessment_logs table (referenced in server.js)
CREATE TABLE IF NOT EXISTS public.assessment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  category_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for assessments table
DROP TRIGGER IF EXISTS update_assessments_updated_at ON public.assessments;
CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
