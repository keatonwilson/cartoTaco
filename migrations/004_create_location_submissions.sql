-- Migration: Create location_submissions table for user-submitted taco establishments
-- This allows authenticated users to submit new locations for admin review

-- Create enum for submission status
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for establishment type (matches existing sites table)
CREATE TYPE establishment_type AS ENUM ('Brick and Mortar', 'Stand', 'Truck');

-- Create location_submissions table
CREATE TABLE location_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Basic information
    name VARCHAR(100) NOT NULL CHECK (char_length(name) >= 3),
    type establishment_type NOT NULL,
    address TEXT NOT NULL CHECK (char_length(address) >= 10),
    latitude NUMERIC(10, 8) NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
    longitude NUMERIC(11, 8) NOT NULL CHECK (longitude >= -180 AND longitude <= 180),

    -- Descriptions
    short_description VARCHAR(150) CHECK (short_description IS NULL OR char_length(short_description) >= 10),
    long_description VARCHAR(500),

    -- Contact information (all optional)
    phone VARCHAR(20),
    website TEXT,
    instagram VARCHAR(100),
    facebook VARCHAR(100),

    -- Hours (stored as JSONB for flexibility)
    -- Format: { "monday": { "open": "08:00", "close": "20:00" }, ... }
    hours JSONB,

    -- Submission metadata
    status submission_status NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    review_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_location_submissions_user_id ON location_submissions(user_id);
CREATE INDEX idx_location_submissions_status ON location_submissions(status);
CREATE INDEX idx_location_submissions_submitted_at ON location_submissions(submitted_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_location_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER location_submissions_updated_at
    BEFORE UPDATE ON location_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_location_submissions_updated_at();

-- Enable Row Level Security
ALTER TABLE location_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view only their own submissions
CREATE POLICY "Users can view their own submissions"
    ON location_submissions
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Authenticated users can insert their own submissions
CREATE POLICY "Authenticated users can create submissions"
    ON location_submissions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update only their own pending submissions
CREATE POLICY "Users can update their own pending submissions"
    ON location_submissions
    FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- RLS Policy: Users can delete only their own pending submissions
CREATE POLICY "Users can delete their own pending submissions"
    ON location_submissions
    FOR DELETE
    USING (auth.uid() = user_id AND status = 'pending');

-- Note: Admin access policies should be created separately based on admin role setup
-- For now, admins can query directly through Supabase dashboard with service role key

-- Add helpful comments
COMMENT ON TABLE location_submissions IS 'User-submitted taco establishment locations awaiting admin review';
COMMENT ON COLUMN location_submissions.hours IS 'Operating hours in JSONB format: { "monday": { "open": "HH:MM", "close": "HH:MM" }, ... }';
COMMENT ON COLUMN location_submissions.status IS 'Submission workflow status: pending (awaiting review), approved (added to main tables), rejected (declined)';
