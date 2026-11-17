-- Notification preferences per device (RoutineAPP, Nov 2026).
-- Run once in the Supabase SQL editor. Safe to run again.
-- The app sends these with its FCM token (api/register-token.js); api/announcements.js uses them to
-- skip notice pushes a device turned off or paused, and to send quietly during its quiet hours.
-- Until this runs, both endpoints fall back to the old behaviour (every device gets every push).
ALTER TABLE public.device_tokens ADD COLUMN IF NOT EXISTS prefs jsonb;
