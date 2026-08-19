-- Link a vacancy's hiring manager to an org user (was free-text name only).
-- The UI shows a searchable dropdown of org members; hiring_manager_name is kept
-- for display/back-compat, hiring_manager_id is the real link.
--
-- Apply on BOTH Supabase projects (staging quotchdymcnjlnwtjmgu + production
-- fnpyfwhvgzoxgyjafbsg). ON DELETE SET NULL so removing a member doesn't delete
-- their vacancies; the name column preserves who it was.

alter table public.vacancies
  add column if not exists hiring_manager_id uuid references public.profiles(id) on delete set null;
