ALTER TABLE proposals ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'proposal';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS reverts_id text;
