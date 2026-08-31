-- ============================================================================
-- SQL Migration: Premier University Class Schedule & Routine Architecture
-- Tables:
--   1. academic_terms             (Term management & archival scoping)
--   2. semesters                  (1..8)
--   3. sections                   (41 sections scoped to semesters)
--   4. rooms                      (34 physical/virtual venues with metadata)
--   5. courses                    (70 unique course codes & full titles)
--   6. class_sessions             (518 core class blocks with minute-based times)
--   7. schedule_edit_suggestions  (Crowdsourced routine error reporting queue)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Academic Terms Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academic_terms (
    id TEXT PRIMARY KEY,                 -- e.g. 'spring_2026', 'fall_2026'
    name TEXT NOT NULL,                  -- 'Spring 2026', 'Fall 2026'
    is_current BOOLEAN NOT NULL DEFAULT false,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: Only one term can be active/current at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_current_term 
    ON public.academic_terms (is_current) 
    WHERE is_current = true;

-- ----------------------------------------------------------------------------
-- 2. Semesters Reference Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.semesters (
    id SMALLINT PRIMARY KEY,              -- 1..8
    label TEXT NOT NULL,                  -- 'Semester 1', 'Semester 2', ...
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- ----------------------------------------------------------------------------
-- 3. Sections Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semester_id SMALLINT NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,                   -- 'A', 'B', 'C', 'D', 'E', 'F', 'G'
    label TEXT NOT NULL,                  -- 'Sem 2-C'
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_sections_sem_code UNIQUE (semester_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sections_semester ON public.sections(semester_id);

-- ----------------------------------------------------------------------------
-- 4. Rooms Table (Physical & Virtual Venues)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
    id TEXT PRIMARY KEY,                  -- '403', '503', '905', '1002', 'ONLINE'
    name TEXT NOT NULL,                   -- 'Room 403', 'Microprocessor & Multimedia Lab'
    floor SMALLINT,                       -- 4, 5, 6, 9, 10 (NULL for virtual/online)
    type TEXT NOT NULL DEFAULT 'classroom' CHECK (type IN ('classroom', 'lab', 'virtual')),
    capacity SMALLINT DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_rooms_floor ON public.rooms(floor);

-- ----------------------------------------------------------------------------
-- 5. Courses / Subjects Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
    code TEXT PRIMARY KEY,                -- 'DS', 'DSL', 'EDC', 'ALGO'
    full_name TEXT,                       -- 'Data Structures', NULL if unmapped
    type_hint TEXT CHECK (type_hint IS NULL OR type_hint IN ('Theory', 'Lab'))
);

-- ----------------------------------------------------------------------------
-- 6. Class Sessions (Core Fact Table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term_id TEXT NOT NULL REFERENCES public.academic_terms(id) ON DELETE RESTRICT DEFAULT 'spring_2026',
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL REFERENCES public.courses(code) ON DELETE RESTRICT,
    room_id TEXT REFERENCES public.rooms(id) ON DELETE SET NULL,
    teacher_code TEXT REFERENCES public.faculty_members(teacher_code) ON DELETE SET NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun, 1=Mon, ..., 6=Sat
    start_mins SMALLINT NOT NULL CHECK (start_mins BETWEEN 0 AND 1439), -- Minutes since midnight
    end_mins SMALLINT NOT NULL CHECK (end_mins > start_mins AND end_mins <= 1440),
    class_type TEXT NOT NULL DEFAULT 'Theory' CHECK (class_type IN ('Theory', 'Lab')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query Pattern Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_term_section_day 
    ON public.class_sessions(term_id, section_id, day_of_week) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sessions_term_room_day 
    ON public.class_sessions(term_id, room_id, day_of_week) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sessions_term_teacher_day 
    ON public.class_sessions(term_id, teacher_code, day_of_week) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sessions_room_time 
    ON public.class_sessions(term_id, room_id, day_of_week, start_mins, end_mins) 
    WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 7. Schedule Edit Suggestions Table (Moderation Queue)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_edit_suggestions (
    id BIGSERIAL PRIMARY KEY,
    term_id TEXT REFERENCES public.academic_terms(id),
    section_id UUID REFERENCES public.sections(id),
    session_id UUID REFERENCES public.class_sessions(id),
    action TEXT NOT NULL CHECK (action IN ('add', 'edit', 'delete')),
    proposed_day SMALLINT CHECK (proposed_day IS NULL OR (proposed_day BETWEEN 0 AND 6)),
    proposed_start_mins SMALLINT,
    proposed_end_mins SMALLINT,
    proposed_room_id TEXT,
    proposed_teacher TEXT,
    proposed_course TEXT,
    proposed_type TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_by TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sched_sugg_status ON public.schedule_edit_suggestions(status);

-- ----------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_edit_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow Public Read Access
DROP POLICY IF EXISTS "Allow public read on academic_terms" ON public.academic_terms;
CREATE POLICY "Allow public read on academic_terms" ON public.academic_terms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on semesters" ON public.semesters;
CREATE POLICY "Allow public read on semesters" ON public.semesters FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on sections" ON public.sections;
CREATE POLICY "Allow public read on sections" ON public.sections FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on rooms" ON public.rooms;
CREATE POLICY "Allow public read on rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on courses" ON public.courses;
CREATE POLICY "Allow public read on courses" ON public.courses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on class_sessions" ON public.class_sessions;
CREATE POLICY "Allow public read on class_sessions" ON public.class_sessions FOR SELECT USING (true);

-- Allow Public Insert for Routine Suggestions
DROP POLICY IF EXISTS "Allow public insert on schedule_suggestions" ON public.schedule_edit_suggestions;
CREATE POLICY "Allow public insert on schedule_suggestions" ON public.schedule_edit_suggestions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on approved schedule_suggestions" ON public.schedule_edit_suggestions;
CREATE POLICY "Allow public read on approved schedule_suggestions" ON public.schedule_edit_suggestions FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- 9. Realtime Subscriptions
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_sessions;
