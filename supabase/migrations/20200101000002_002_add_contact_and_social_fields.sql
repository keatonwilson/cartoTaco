-- Migration: Add contact and social media fields to sites table
-- This adds fields for phone, website, and social media links
--
-- Run this in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run

-- Add new columns to sites table
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS instagram text,
ADD COLUMN IF NOT EXISTS facebook text,
ADD COLUMN IF NOT EXISTS address text;

-- Add comments explaining the new fields
COMMENT ON COLUMN public.sites.phone IS 'Phone number in format: (520) 123-4567';
COMMENT ON COLUMN public.sites.website IS 'Full website URL including https://';
COMMENT ON COLUMN public.sites.instagram IS 'Instagram handle without @ symbol';
COMMENT ON COLUMN public.sites.facebook IS 'Facebook page name or ID';
COMMENT ON COLUMN public.sites.address IS 'Street address of establishment';

-- Example update statements (uncomment and modify to add data for existing locations)
-- UPDATE public.sites SET
--   phone = '(520) 123-4567',
--   website = 'https://example.com',
--   instagram = 'tacoshop',
--   facebook = 'tacoshoppage',
--   address = '123 Main St, Tucson, AZ 85701'
-- WHERE est_id = 1;
