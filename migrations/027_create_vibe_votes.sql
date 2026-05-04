-- Migration 027: Create vibe_votes table for the anti-review feature.
-- Users vote across four binary emoji dimensions per spot:
--   heat_legit (the heat is real), authentic (tastes legit),
--   value (worth the price), vibe (atmosphere/experience)
-- One vote per (user, est_id, dimension); toggleable via insert/delete.

CREATE TYPE vibe_dimension AS ENUM ('heat_legit', 'authentic', 'value', 'vibe');

CREATE TABLE IF NOT EXISTS vibe_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    est_id INTEGER NOT NULL,
    dimension vibe_dimension NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    UNIQUE(user_id, est_id, dimension)
);

CREATE INDEX idx_vibe_votes_user_id ON vibe_votes(user_id);
CREATE INDEX idx_vibe_votes_est_id ON vibe_votes(est_id);

ALTER TABLE vibe_votes ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read votes — counts are public on every Card.
CREATE POLICY "Anyone can view vibe votes"
    ON vibe_votes
    FOR SELECT
    USING (true);

-- Authenticated users manage only their own votes.
CREATE POLICY "Users can insert own vibe votes"
    ON vibe_votes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vibe votes"
    ON vibe_votes
    FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON TABLE vibe_votes IS 'Anti-review: binary emoji votes per dimension per user per spot';
COMMENT ON COLUMN vibe_votes.dimension IS 'One of: heat_legit, authentic, value, vibe';
