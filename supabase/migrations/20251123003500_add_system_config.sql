-- Create system configuration table
CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default AI configuration
INSERT INTO system_config (key, value, description) VALUES
  ('ai_provider', 'openai', 'AI provider: openai, gemini, or deepseek'),
  ('ai_model', 'gpt-4o-mini', 'AI model name'),
  ('openai_api_key', '', 'OpenAI API Key'),
  ('gemini_api_key', '', 'Google Gemini API Key'),
  ('deepseek_api_key', '', 'DeepSeek API Key')
ON CONFLICT (key) DO NOTHING;

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Add comment
COMMENT ON TABLE system_config IS 'System-wide configuration settings including AI provider configuration';
