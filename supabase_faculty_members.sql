-- ============================================================================
-- SQL Migration: Create live faculty_members table for Premier University
-- ============================================================================

CREATE TABLE IF NOT EXISTS faculty_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_code TEXT UNIQUE NOT NULL,
  official_username TEXT,
  name TEXT NOT NULL,
  designation TEXT DEFAULT 'Faculty Member',
  department TEXT DEFAULT 'CSE',
  photo TEXT DEFAULT '',
  source_photo_url TEXT DEFAULT '',
  status TEXT DEFAULT 'Active',
  emails TEXT[] DEFAULT '{}'::TEXT[],
  phone TEXT DEFAULT '',
  profile_url TEXT DEFAULT '',
  social_links JSONB DEFAULT '{}'::JSONB,
  aliases TEXT[] DEFAULT '{}'::TEXT[],
  source TEXT DEFAULT 'seed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_faculty_code ON faculty_members(teacher_code);
CREATE INDEX IF NOT EXISTS idx_faculty_username ON faculty_members(official_username);

-- Enable Row Level Security (RLS)
ALTER TABLE faculty_members ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Policy (Allow anyone using anon key or unauthenticated to read faculty)
DROP POLICY IF EXISTS "Allow public read" ON faculty_members;
CREATE POLICY "Allow public read" ON faculty_members FOR SELECT USING (true);

-- 2. Restrict all INSERT / UPDATE / DELETE to service_role (Admin / API endpoints only)
-- (No public write policy exists, meaning anon key writes are completely blocked by default)

-- Ensure source_photo_url and source columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'faculty_members' AND column_name = 'source_photo_url'
  ) THEN
    ALTER TABLE faculty_members ADD COLUMN source_photo_url TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'instructor_edit_suggestions' AND column_name = 'source'
  ) THEN
    ALTER TABLE instructor_edit_suggestions ADD COLUMN source TEXT DEFAULT 'user_suggestion';
  END IF;
END $$;
