-- Remove the Saved Views feature.
--
-- "Views" was cut from the Vacancies/Candidates toolbars (redundant with the
-- filter tabs at this org scale). The app code (menu, dialogs, actions,
-- encoding, tests) is removed in the same change; this drops the backing table.
--
-- Historical `activity_log` rows with action = 'saved_view_*' are left in place
-- (they're an accurate record of what happened); no new ones are written.
--
-- Apply on BOTH Supabase projects (staging + production).

DROP TABLE IF EXISTS public.saved_views CASCADE;
