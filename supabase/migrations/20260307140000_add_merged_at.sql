ALTER TABLE proposals ADD COLUMN IF NOT EXISTS merged_at timestamptz;
-- Backfill existing approved proposals using their timestamp (epoch ms)
UPDATE proposals SET merged_at = to_timestamp(timestamp / 1000.0)
  WHERE status = 'approved' AND merged_at IS NULL;
