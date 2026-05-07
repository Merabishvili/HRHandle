# HRHandle — Roles & Permissions

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

### Supabase RLS
- All tenant data tables enforce Row Level Security. All queries from the server Supabase client use the authenticated user's JWT, so RLS policies automatically restrict cross-org access.
- Admin client (`createAdminClient`) bypasses RLS — used only for privileged server-side operations (onboarding, storage, notifications).

## Auth Context

`getAuthContext()` in `lib/actions/index.ts`:
1. Calls `supabase.auth.getUser()`.
2. Fetches `profiles` row: `organization_id`, `role`.
3. Returns `{ supabase, userId, orgId, role }` or `null` if unauthenticated / no org.

Every server action that modifies data calls `getAuthContext()` first and returns `{ success: false, error: 'Not authenticated' }` if null.

## Data Scoping

All Supabase queries in server actions are scoped with `.eq('organization_id', ctx.orgId)` to prevent cross-org data access. This is a defence-in-depth measure on top of Supabase RLS policies.
