-- Support tickets (in-app + public support form).
-- Apply on BOTH Supabase projects (staging + production).
--
-- Rows are written exclusively by the `submitSupportTicket` server action via
-- the admin (service-role) client, which bypasses RLS. RLS is enabled with no
-- permissive policies, so the anon/authenticated roles cannot read or write
-- tickets directly (there is no ticket-list UI yet). Attachments live in a
-- private Storage bucket accessed only through short-lived signed URLs.

create table if not exists public.support_tickets (
  id                uuid primary key default gen_random_uuid(),
  -- Nullable: a public (logged-out) submitter has no org/user.
  organization_id   uuid references public.organizations(id) on delete set null,
  user_id           uuid references public.profiles(id)      on delete set null,
  email             text not null,
  subject           text not null,
  message           text not null,
  -- Up to 3 attachments: parallel arrays of storage paths + original filenames.
  attachment_paths  text[] not null default '{}',
  attachment_names  text[] not null default '{}',
  status            text not null default 'open' check (status in ('open', 'closed')),
  source            text not null default 'app'  check (source in ('app', 'public')),
  created_at        timestamptz not null default now()
);

create index if not exists idx_support_tickets_org     on public.support_tickets (organization_id);
create index if not exists idx_support_tickets_created on public.support_tickets (created_at desc);

alter table public.support_tickets enable row level security;
-- No policies: all access is service-role (admin client) only.

comment on table public.support_tickets is
  'User-submitted support requests (in-app + public form). Written only by the submitSupportTicket server action via the service-role client; RLS on with no policies.';

-- Idempotent upgrade path: an earlier version of this migration used single
-- `attachment_path` / `attachment_name` columns. Convert them to arrays (up to
-- 3 attachments). No-op on a fresh table where the array columns already exist,
-- so this whole file stays safe to re-run.
alter table public.support_tickets
  drop column if exists attachment_path,
  drop column if exists attachment_name,
  add column if not exists attachment_paths text[] not null default '{}',
  add column if not exists attachment_names text[] not null default '{}';

-- Private bucket for optional ticket attachments.
insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;
