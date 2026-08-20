-- Store the connected Zoom user's id so the deauthorization webhook can find
-- WHOSE tokens to delete when they uninstall the app — a Zoom Marketplace
-- security-review requirement. Nullable, best-effort populated on connect.
--
-- Apply on BOTH Supabase projects (staging quotchdymcnjlnwtjmgu + production
-- fnpyfwhvgzoxgyjafbsg). Deploy-order-safe: the callback writes it in a separate
-- best-effort update, and the webhook simply matches nothing until it's applied.

alter table public.profiles
  add column if not exists zoom_user_id text;

create index if not exists profiles_zoom_user_id_idx
  on public.profiles (zoom_user_id)
  where zoom_user_id is not null;
