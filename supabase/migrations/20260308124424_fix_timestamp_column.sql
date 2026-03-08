-- Convert timestamp from bigint to timestamptz
ALTER TABLE proposals
  ALTER COLUMN timestamp TYPE timestamptz
  USING to_timestamp(timestamp / 1000.0);

-- Add error_message column that the code expects
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS error_message text;
