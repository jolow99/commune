ALTER TABLE site_state ADD COLUMN IF NOT EXISTS spec text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS spec text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS base_spec_hash text;
