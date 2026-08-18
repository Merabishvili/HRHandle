# HRHandle — Roles & Permissions

_Last updated: 2026-07-20_

## Changelog

- 🆕 **(2026-07-20 audit) Additional owner/admin-gated surfaces:** org-wide 2FA policy (`require_mfa`) — owner only; CSV candidate import (`/candidates/import`) — owner+admin; integrations (Slack/Teams webhooks, Calendly) — owner+admin; per-vacancy pipeline-stage management — owner+admin; self-serve org delete — owner. The dominant gate helper is `isOrgAdmin(ctx)` (~63 call sites); `role === 'owner'` guards ownership-only actions. Member-only redirects now target `/pipeline` (was `/dashboard`).
- 🔄 (revised 2026-05-08) Live-DB verification confirms RLS is enabled on every public table — earlier "RLS gaps" claim retracted. See "Supabase RLS" section below.
- 🆕 LinkedIn-integration management (save / disconnect) gated to owner+admin via `organization_integrations` RLS.
- 🆕 Custom field management gated to owner+admin (`lib/actions/custom-fields.ts:104`).
- 🆕 Rejection-reason management gated to owner+admin (`lib/actions/rejection-reasons.ts:35-36, 75-76, 99-100`).

---

## Roles

| Role | Assigned | Description |
|------|----------|-------------|
| `owner` | First user of an org (via onboarding) | Full control over org |
| `admin` | Invited by owner/admin | Elevated access, no org ownership actions |
| `member` | Invited by owner/admin | Basic read/create access |

## Permission Matrix

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Create/edit/delete vacancy | Yes | Yes | Yes |
| View vacancies and candidates | Yes | Yes | Yes |
| Create/edit candidate | Yes | Yes | Yes |
| Delete candidate | Yes | Yes | Yes |
| Add application | Yes | Yes | Yes |
| Move application (pipeline) | Yes | Yes | Yes |
| Reject application with email | Yes | Yes | Yes |
| Schedule interview | Yes | Yes | Yes |
| Invite team members | Yes | Yes | No |
| Revoke invitations | Yes | Yes | No |
| Update organization settings | Yes | No | No |
| Update organization logo | Yes | No | No |
| View team settings page | Yes | Yes | No (redirected to profile) |
| View subscription page | Yes | Yes | No (redirected to dashboard) |
| Access billing page | Yes | Yes | No |

## Where Checks Occur

### Layout-level (server)
- `app/(dashboard)/settings/team/page.tsx`: redirects non-admin/owner to `/settings/profile`.
- `app/(dashboard)/subscription/page.tsx`: redirects `member` role to `/dashboard`.

### Action-level (server actions)
- `lib/actions/settings.ts#updateOrganization`: rejects if `ctx.role !== 'owner'`.
- `lib/actions/invitations.ts#inviteTeamMember`: rejects if `ctx.role !== 'owner' && ctx.role !== 'admin'`.
- `lib/actions/invitations.ts#revokeInvitation`: rejects if `ctx.role !== 'owner' && ctx.role !== 'admin'`.

### Plan-limit checks
- `lib/actions/index.ts#checkPlanLimit`: called before create operations for vacancy, candidate, member.

### Supabase RLS 🔄 (corrected 2026-05-08 via live-DB check)
- **Every public table has RLS enabled and at least one policy.** Verified via `pg_policies`: `vacancies`, `candidates`, `applications` have 4 policies each, `profiles` has 6, the rest have 1–3.
- The original RLS migration is not checked in to `supabase/migrations/` — only later additive ones are. This caused an earlier audit pass to incorrectly report RLS as missing on most tables.
- `.eq('organization_id', ctx.orgId)` filtering in server actions remains defence-in-depth.
- Admin client (`createAdminClient`) bypasses RLS — used for privileged server-side operations (onboarding, storage, notifications, public-apply).
- ⚠️ Advisor flagged `notifications.Service role insert notifications` policy as `WITH CHECK (true)` — effectively unconditional INSERT (tracked as `S-NEW-2`).

## Auth Context

`getAuthContext()` in `lib/actions/index.ts`:
1. Calls `supabase.auth.getUser()`.
2. Fetches `profiles` row: `organization_id`, `role`.
3. Returns `{ supabase, userId, orgId, role }` or `null` if unauthenticated / no org.

Every server action that modifies data calls `getAuthContext()` first and returns `{ success: false, error: 'Not authenticated' }` if null.

## Data Scoping

All Supabase queries in server actions are scoped with `.eq('organization_id', ctx.orgId)` to prevent cross-org data access. This is a defence-in-depth measure on top of Supabase RLS policies.
