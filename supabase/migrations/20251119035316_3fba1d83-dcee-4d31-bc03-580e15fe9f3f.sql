-- Drop existing constraint if it exists
ALTER TABLE public.ai_config DROP CONSTRAINT IF EXISTS ai_config_provider_check;

-- Add new constraint that allows gemini, openai, and lovable
ALTER TABLE public.ai_config 
ADD CONSTRAINT ai_config_provider_check 
CHECK (provider IN ('gemini', 'openai', 'lovable'));