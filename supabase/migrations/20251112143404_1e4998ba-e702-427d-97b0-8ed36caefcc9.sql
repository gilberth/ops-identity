-- Create table for AI configuration
CREATE TABLE public.ai_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini', 'lovable')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

-- Allow all operations (admin only feature)
CREATE POLICY "Allow all operations on ai_config"
ON public.ai_config
FOR ALL
USING (true)
WITH CHECK (true);

-- Insert default configuration
INSERT INTO public.ai_config (provider) VALUES ('gemini');

-- Create trigger for updated_at
CREATE TRIGGER update_ai_config_updated_at
BEFORE UPDATE ON public.ai_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();