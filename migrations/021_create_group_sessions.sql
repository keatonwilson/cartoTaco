-- Migration 021: Create group_sessions table for Taco Summit feature
-- Each session represents a voting round with a set of spots and a shareable link

CREATE TABLE IF NOT EXISTS group_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at     TIMESTAMPTZ,
  creator_token TEXT        NOT NULL,
  site_ids      INTEGER[]   NOT NULL,
  title         TEXT        NOT NULL DEFAULT 'Taco Summit'
);

-- Enable RLS
ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read sessions (needed to display ballot and results)
CREATE POLICY "group_sessions_select" ON group_sessions
  FOR SELECT USING (true);

-- Anyone can create a session (anonymous-friendly)
CREATE POLICY "group_sessions_insert" ON group_sessions
  FOR INSERT WITH CHECK (true);

-- Anyone can update a session (creator_token match is enforced in the app query)
CREATE POLICY "group_sessions_update" ON group_sessions
  FOR UPDATE USING (true);
