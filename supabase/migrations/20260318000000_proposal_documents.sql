-- Add body column for document-type proposals
ALTER TABLE proposals ADD COLUMN body TEXT;

-- Edit suggestions table
CREATE TABLE proposal_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id TEXT REFERENCES proposals(id) NOT NULL,
  author TEXT NOT NULL,
  original_text TEXT NOT NULL,
  suggested_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
