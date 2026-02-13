-- Migration 005: Create favorites table for user-saved locations
-- This allows authenticated users to save their favorite taco spots

-- Create favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    est_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    -- Ensure a user can only favorite a location once
    UNIQUE(user_id, est_id)
);

-- Create index for faster queries by user
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);

-- Create index for faster queries by establishment
CREATE INDEX idx_user_favorites_est_id ON user_favorites(est_id);

-- Enable Row Level Security
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Users can view their own favorites
CREATE POLICY "Users can view own favorites"
    ON user_favorites
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own favorites
CREATE POLICY "Users can insert own favorites"
    ON user_favorites
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own favorites
CREATE POLICY "Users can delete own favorites"
    ON user_favorites
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE user_favorites IS 'Stores user favorite taco locations';

-- Add comments to columns
COMMENT ON COLUMN user_favorites.user_id IS 'Reference to authenticated user';
COMMENT ON COLUMN user_favorites.est_id IS 'Establishment ID from sites table';
COMMENT ON COLUMN user_favorites.created_at IS 'Timestamp when favorite was added';
