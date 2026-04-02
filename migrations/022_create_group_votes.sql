-- Migration 022: Create group_votes table for Taco Summit ranked-choice ballots
-- Each row is one spot's rank within one voter's ballot for a session

CREATE TABLE IF NOT EXISTS group_votes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  voter_token  TEXT        NOT NULL,
  est_id       INTEGER     NOT NULL,
  rank         INTEGER     NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, voter_token, est_id)
);

-- Index for fast per-session vote fetching
CREATE INDEX IF NOT EXISTS group_votes_session_id_idx ON group_votes(session_id);

-- Enable RLS
ALTER TABLE group_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read votes (results are public/anonymous — no PII stored)
CREATE POLICY "group_votes_select" ON group_votes
  FOR SELECT USING (true);

-- Anyone can insert votes
CREATE POLICY "group_votes_insert" ON group_votes
  FOR INSERT WITH CHECK (true);

-- Anyone can delete their own votes (voter_token match enforced in app query)
CREATE POLICY "group_votes_delete" ON group_votes
  FOR DELETE USING (true);
