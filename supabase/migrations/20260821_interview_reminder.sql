-- Interview reminders (#9). A daily cron (/api/cron/interview-reminders) pings
-- the interviewer (or the org's owners/admins when unassigned) about interviews
-- starting in the next ~26h. `reminder_sent_at` guarantees each interview is
-- reminded at most once, so the look-ahead window can safely overlap runs.
--
-- Apply on BOTH Supabase projects (staging quotchdymcnjlnwtjmgu + production
-- fnpyfwhvgzoxgyjafbsg). Deploy-order-safe: the cron simply finds nothing to
-- remind until this column exists.

alter table public.interviews
  add column if not exists reminder_sent_at timestamptz;

-- Partial index for the cron's due-scan: upcoming, still scheduled, not yet reminded.
create index if not exists idx_interviews_reminder_due
  on public.interviews (scheduled_at)
  where reminder_sent_at is null and status = 'scheduled';
