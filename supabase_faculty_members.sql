-- ============================================================================
-- SQL Migration: Setup Premier University Faculty Architecture
-- Creates:
--   1. faculty_members (Live Production Directory)
--   2. instructor_edit_suggestions (Pending Suggestions Queue)
--   3. Automatically migrates legacy data from teacher_names if present
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create faculty_members Table (Live Directory)
-- ----------------------------------------------------------------------------
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

-- Enable Row Level Security (RLS) on faculty_members
ALTER TABLE faculty_members ENABLE ROW LEVEL SECURITY;

-- Allow public read (All students and teachers can read active faculty)
DROP POLICY IF EXISTS "Allow public read on faculty_members" ON faculty_members;
CREATE POLICY "Allow public read on faculty_members" ON faculty_members FOR SELECT USING (true);


-- ----------------------------------------------------------------------------
-- 2. Create instructor_edit_suggestions Table (Moderation Queue)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instructor_edit_suggestions (
  id BIGSERIAL PRIMARY KEY,
  teacher_code TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  designation TEXT,
  photo TEXT,
  source_photo_url TEXT,
  profile_url TEXT,
  old_data JSONB,
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'user_suggestion',
  ip_address TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Fast lookup indexes on suggestions
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON instructor_edit_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_code ON instructor_edit_suggestions(teacher_code);

-- Enable Row Level Security (RLS) on instructor_edit_suggestions
ALTER TABLE instructor_edit_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow public insert (Crowdsourced suggestions from students/teachers)
DROP POLICY IF EXISTS "Allow public insert on suggestions" ON instructor_edit_suggestions;
CREATE POLICY "Allow public insert on suggestions" ON instructor_edit_suggestions FOR INSERT WITH CHECK (true);

-- Allow public read on approved suggestions
DROP POLICY IF EXISTS "Allow public read on approved suggestions" ON instructor_edit_suggestions;
CREATE POLICY "Allow public read on approved suggestions" ON instructor_edit_suggestions FOR SELECT USING (true);


-- ----------------------------------------------------------------------------
-- 3. Automatic Legacy Data Migration (from teacher_names if it exists)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'teacher_names'
  ) THEN
    INSERT INTO instructor_edit_suggestions (
      teacher_code, full_name, email, phone, designation, status, submitted_at, reviewed_at, source
    )
    SELECT 
      teacher_code, 
      full_name, 
      email, 
      phone, 
      designation, 
      status, 
      submitted_at, 
      reviewed_at, 
      'legacy_teacher_names'
    FROM teacher_names;
    
    RAISE NOTICE 'Successfully migrated legacy rows from teacher_names to instructor_edit_suggestions.';
  END IF;
END $$;
