ALTER TABLE proposals ADD COLUMN IF NOT EXISTS user_prompt text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS base_files_hash text;
