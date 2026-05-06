-- Add ai_base_url for self-hosted model platforms (Ollama, vLLM, etc.)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ai_base_url TEXT;
