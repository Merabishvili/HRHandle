-- #1 — Per-user language preference (for future localization).
--
-- Stores a short language code (e.g. 'en', 'ka', 'ru', 'es', 'fr', 'de').
-- Kept as free TEXT (no CHECK) so new languages can be offered without a
-- migration; NULL = not set / use the default.
--
-- Apply on staging now; apply on production with the deploy.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language TEXT;

COMMENT ON COLUMN public.profiles.language IS
  '#1 — preferred UI language code (en/ka/ru/…); NULL = default.';
