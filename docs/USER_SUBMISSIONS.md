# User Submission Feature - Design Document

## Overview
Allow end-users to submit new taco locations to CartoTaco. Submissions go through a moderation queue where they can be reviewed and approved in the database before publishing to the live site.

## User Requirements

### 1. Submission Workflow
- **Moderation Queue**: All submissions go to a `location_submissions` table
- Submissions require manual approval before appearing on the map
- Admin reviews and approves directly in the database (no dedicated admin UI needed initially)

### 2. Required Fields
The goal is to collect enough data to populate the app with a functional location listing. Required fields include:

**Basic Information:**
- Name (text) - establishment name
- Type (select) - Brick and Mortar / Stand / Truck
- Address (text) - full street address
- Latitude (number) - auto-geocoded from address OR manual pin drop
- Longitude (number) - auto-geocoded from address OR manual pin drop

**Contact Information:**
- Phone (text, optional) - formatted (520) XXX-XXXX
- Website (URL, optional)
- Instagram (text, optional) - handle or URL
- Facebook (text, optional) - handle or URL

**Descriptive Information:**
- Short Description (text, required, max 150 chars) - one-sentence summary
- Long Description (textarea, optional, max 500 chars) - detailed description

**Operating Hours:**
- Hours (structured, optional) - day-by-day start/end times
  - Could use a day-of-week picker with time inputs
  - Or simplified "Always Open" / "By Appointment" options

**Submitter Information:**
- Email (required) - for follow-up/verification, not displayed publicly
- Submitter Name (optional) - for attribution if desired

**Fields NOT Required for Initial Submission:**
These can be added later by admin after approval:
- Menu items and ratings
- Protein options and ratings
- Salsa varieties and heat levels
- Specialty items

### 3. Authentication
- **Email required** for submission (spam prevention, follow-up)
- **No full authentication needed** - anonymous submission with email
- Consider: email verification link to prevent abuse (optional enhancement)

### 4. UI/UX Design

**Submission Page:**
- Dedicated route: `/submit` or `/add-location`
- Clean, friendly form with clear field labels
- Map preview showing pin placement (if lat/lon provided or geocoded)
- Progress indicator if multi-step form
- Clear "Submit for Review" button

**Navigation:**
- "Add a Location" button/link in main navigation
- Prominent CTA on map (floating button or header link)

**Form Validation:**
- Client-side validation for required fields
- Format validation (email, phone, URLs)
- Address geocoding with preview
- Clear error messages

**Success Flow:**
- Confirmation message: "Thanks for your submission!"
- Set expectations: "We'll review your submission and add it to the map soon"
- Optional: "Check your email for confirmation"

### 5. Admin Review Workflow

**Database-Level Review (No Admin UI Initially):**
- Review submissions directly in Supabase dashboard
- Check for duplicates, verify data quality
- Approve: copy data to main `sites`, `descriptions`, and `hours` tables
- Reject: delete submission (or add rejection reason field for future)
- Optional: email submitter on approval/rejection (future enhancement)

**Future Enhancement:**
- Admin dashboard page for easier review (`/admin/submissions`)
- Bulk approve/reject
- Edit before publishing
- Duplicate detection alerts

## Technical Implementation

### Database Schema

**New Table: `location_submissions`**
```sql
CREATE TABLE location_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic info
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Brick and Mortar', 'Stand', 'Truck')),
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,

  -- Contact info
  phone TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,

  -- Descriptions
  short_description TEXT NOT NULL,
  long_description TEXT,

  -- Hours (JSONB for flexibility)
  hours JSONB,

  -- Submitter info
  submitter_email TEXT NOT NULL,
  submitter_name TEXT,

  -- Metadata
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  rejection_reason TEXT,

  -- Indexes
  CREATE INDEX idx_submissions_status ON location_submissions(status),
  CREATE INDEX idx_submissions_submitted_at ON location_submissions(submitted_at DESC)
);
```

**Hours JSONB Structure:**
```json
{
  "monday": {"start": "10:00", "end": "22:00"},
  "tuesday": {"start": "10:00", "end": "22:00"},
  "wednesday": {"start": "10:00", "end": "22:00"},
  "thursday": {"start": "10:00", "end": "22:00"},
  "friday": {"start": "10:00", "end": "23:00"},
  "saturday": {"start": "09:00", "end": "23:00"},
  "sunday": {"start": "09:00", "end": "21:00"}
}
```

### Frontend Components

**New Route: `src/routes/submit/+page.svelte`**
- Full-page submission form
- Map preview component for location verification
- Form validation and error handling
- Success state with confirmation message

**New Component: `src/components/SubmissionForm.svelte`**
- Multi-section form (Basic Info, Contact, Description, Hours)
- Geocoding integration (Mapbox Geocoding API)
- Map picker for manual lat/lon adjustment
- Client-side validation

**Helper: `src/lib/geocoding.js`**
- Address → lat/lon conversion
- Reverse geocoding for verification
- Integration with Mapbox Geocoding API

### API Integration

**Supabase Insert:**
```javascript
// src/lib/submissions.js
export async function submitLocation(data) {
  const { data: result, error } = await supabase
    .from('location_submissions')
    .insert([{
      name: data.name,
      type: data.type,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      phone: data.phone || null,
      website: data.website || null,
      instagram: data.instagram || null,
      facebook: data.facebook || null,
      short_description: data.shortDescription,
      long_description: data.longDescription || null,
      hours: data.hours || null,
      submitter_email: data.email,
      submitter_name: data.name || null,
      status: 'pending'
    }]);

  if (error) throw error;
  return result;
}
```

**Geocoding Integration:**
```javascript
// src/lib/geocoding.js
export async function geocodeAddress(address) {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_KEY}&limit=1`
  );
  const data = await response.json();

  if (data.features && data.features.length > 0) {
    const [lon, lat] = data.features[0].center;
    return { latitude: lat, longitude: lon };
  }

  throw new Error('Address not found');
}
```

### Validation Rules

**Client-Side:**
- Name: required, 3-100 characters
- Type: required, one of three options
- Address: required, 10-200 characters
- Email: required, valid email format
- Phone: optional, US format (XXX) XXX-XXXX
- Website: optional, valid URL
- Instagram/Facebook: optional, URL or handle
- Short Description: required, 10-150 characters
- Long Description: optional, max 500 characters

**Server-Side (Database Constraints):**
- CHECK constraints on type and status
- NOT NULL constraints on required fields
- Unique constraint on name+address to prevent duplicates (optional)

## Approval Workflow

### Manual Database Approval Process

1. **Review Submission** in Supabase Dashboard
   - Check `location_submissions` table for `status = 'pending'`
   - Verify data quality, check for duplicates
   - Validate location accuracy on map

2. **Approve Submission**
   - Create new record in `sites` table
   - Create corresponding record in `descriptions` table
   - Create record in `hours` table if hours provided
   - Update submission: `status = 'approved'`, `reviewed_at = NOW()`

3. **Reject Submission**
   - Update submission: `status = 'rejected'`, `reviewed_at = NOW()`
   - Optionally add `rejection_reason`

### Future: Automated Admin Dashboard

Could add `/admin/submissions` page with:
- List of pending submissions
- Preview on map
- One-click approve (creates records + updates status)
- Reject with reason
- Edit before publishing
- Duplicate detection warnings

## Future Enhancements

### Phase 2 Features
- Email verification before submission accepted
- Email notifications on approval/rejection
- Submitter dashboard to track their submissions
- Public attribution ("Submitted by John D.")
- Gamification (submission badges, leaderboard)

### Phase 3 Features
- Allow users to suggest edits to existing locations
- Photo uploads with submissions
- Bulk import from Google Sheets/CSV
- Mobile-optimized submission experience
- "Report an issue" for existing locations

## Migration Script

```sql
-- migrations/003_create_submissions_table.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create location_submissions table
CREATE TABLE IF NOT EXISTS location_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic info
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Brick and Mortar', 'Stand', 'Truck')),
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,

  -- Contact info
  phone TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,

  -- Descriptions
  short_description TEXT NOT NULL,
  long_description TEXT,

  -- Hours (JSONB for flexibility)
  hours JSONB,

  -- Submitter info
  submitter_email TEXT NOT NULL,
  submitter_name TEXT,

  -- Metadata
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  rejection_reason TEXT
);

-- Create indexes for performance
CREATE INDEX idx_submissions_status ON location_submissions(status);
CREATE INDEX idx_submissions_submitted_at ON location_submissions(submitted_at DESC);
CREATE INDEX idx_submissions_email ON location_submissions(submitter_email);

-- Enable Row Level Security (optional, for future admin UI)
ALTER TABLE location_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (submit)
CREATE POLICY "Anyone can submit locations"
  ON location_submissions
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only authenticated admins can view/update
-- (For now, admin uses Supabase dashboard directly, but this sets up future admin UI)
CREATE POLICY "Admins can view all submissions"
  ON location_submissions
  FOR SELECT
  USING (false); -- Disable for now, enable when admin auth is ready

-- Add comment for documentation
COMMENT ON TABLE location_submissions IS 'User-submitted taco locations pending moderation';
```

## Testing Checklist

### Form Validation
- [ ] Required fields prevent submission
- [ ] Email validation works
- [ ] Phone formatting works
- [ ] URL validation works
- [ ] Character limits enforced
- [ ] Type dropdown has all options

### Geocoding
- [ ] Address geocodes correctly
- [ ] Map preview shows correct location
- [ ] Manual pin adjustment works
- [ ] Invalid addresses show error

### Submission Flow
- [ ] Submission creates database record
- [ ] Status defaults to 'pending'
- [ ] Timestamp captures correctly
- [ ] Success message displays
- [ ] Form clears after submission
- [ ] Duplicate submissions prevented (if implemented)

### Database Review
- [ ] Can view pending submissions in Supabase
- [ ] Can approve submission (manual process documented)
- [ ] Can reject submission
- [ ] Approved submissions don't appear in pending list

---

**Last Updated**: 2026-02-11
**Status**: Planning/Design Phase
**Ready for Implementation**: Pending final approval
