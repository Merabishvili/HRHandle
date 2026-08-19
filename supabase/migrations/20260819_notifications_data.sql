-- Notifications i18n: add a structured `data` payload so the title/body can be
-- rendered in each recipient's UI language at display time
-- (lib/notifications/render.ts). Notifications are stored once but read by
-- recipients whose UI language may differ, so we can't pre-render a single
-- localized string — we store the variables instead and localize on read.
--
-- Existing rows (and any created before this column is populated) keep their
-- pre-rendered English `title`/`body`, which the renderer falls back to.
--
-- Apply on BOTH Supabase projects (staging quotchdymcnjlnwtjmgu +
-- production fnpyfwhvgzoxgyjafbsg). Safe to apply before or after the code
-- deploy — createOrgNotifications tolerates the column being absent.

alter table public.notifications add column if not exists data jsonb;
