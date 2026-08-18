# S7 · Settings — flow analysis

> **Status:** Draft 1, authored 2026-06-17. Built against the user-uploaded `Settings.dc.html` (4-category regrouping locked).
>
> **Sources:** [`Settings.dc.html`](../../../redesign/Settings.dc.html), [`audit.md` §4.10](../audit.md#410-·-s7-·-settings-settingsdchtml), [`roadmap.md` Wave 1.2](../roadmap.md). Mobile: degrades gracefully — settings are desktop-by-nature.
>
> **Why this is eighth.** Settings is the org-config surface — the only flow that materially affects every other surface (auth, integrations, MFA, billing). Wave 1.2 ships the 4-category regrouping; two of the sub-pages are NEW (Notifications, Security) and need real spec; the rest mostly inherit existing components.

---

## 1. Current implementation

### Routes today (10 flat sub-pages + 1 separate route)

| Route | File | Lines | Role gate | Notes |
|---|---|---|---|---|
| `/settings` | [`page.tsx`](../../../app/(dashboard)/settings/page.tsx) | 5 | — | Redirects to `/settings/profile` |
| `/settings/profile` | [`profile/page.tsx`](../../../app/(dashboard)/settings/profile/page.tsx) | 94 | all | Profile form + change password + MFA enrollment |
| `/settings/organization` | [`organization/page.tsx`](../../../app/(dashboard)/settings/organization/page.tsx) | 52 | owner | Org form + MFA policy card + danger zone |
| `/settings/team` | [`team/page.tsx`](../../../app/(dashboard)/settings/team/page.tsx) | 53 | admin | Members + roles + invites + MFA reset |
| `/settings/custom-fields` | [`custom-fields/page.tsx`](../../../app/(dashboard)/settings/custom-fields/page.tsx) | 40 | admin | Candidate + vacancy custom field schemas |
| `/settings/email-templates` | [`email-templates/page.tsx`](../../../app/(dashboard)/settings/email-templates/page.tsx) | 46 | admin | `{{variable}}` templates |
| `/settings/rejection-reasons` | [`rejection-reasons/page.tsx`](../../../app/(dashboard)/settings/rejection-reasons/page.tsx) | 39 | admin | Reasons + linked templates |
| `/settings/integrations` | [`integrations/page.tsx`](../../../app/(dashboard)/settings/integrations/page.tsx) | 94 | all | Google / Zoom / MS / LinkedIn + sub-links to webhooks + calendly |
| `/settings/integrations/webhooks` | (sub-page) | — | admin | G-030 Slack/Teams webhooks |
| `/settings/integrations/calendly` | (sub-page) | — | admin | G-031 Calendly OAuth |
| `/settings/audit-log` | [`audit-log/page.tsx`](../../../app/(dashboard)/settings/audit-log/page.tsx) | 100 | admin | G-019 activity_log viewer with filters |
| `/settings/trash` | [`trash/page.tsx`](../../../app/(dashboard)/settings/trash/page.tsx) | 47 | admin | G-020 30-day recovery |
| `/settings/billing` | [`billing/page.tsx`](../../../app/(dashboard)/settings/billing/page.tsx) | 5 | owner | **Redirects to `/subscription`** |
| `/subscription` | [`subscription/page.tsx`](../../../app/(dashboard)/subscription/page.tsx) | **277** | owner | The actual billing UI |

**Total:** 10 sub-pages + 2 nested integration pages + the redirect-loop between `/settings/billing` and `/subscription`.

### Nav component

[`components/settings/settings-nav.tsx`](../../../components/settings/settings-nav.tsx) — 81 lines. Flat `NAV_ITEMS` array, filtered by role (`ownerOnly` / `adminOnly`).

```ts
const NAV_ITEMS: NavItem[] = [
  { href: '/settings/profile',           label: 'Profile',           icon: User },
  { href: '/settings/organization',      label: 'Organization',      icon: Building2,  ownerOnly: true },
  { href: '/settings/team',              label: 'Team',              icon: Users,      adminOnly: true },
  { href: '/settings/custom-fields',     label: 'Custom Fields',     icon: LayoutGrid, adminOnly: true },
  { href: '/settings/email-templates',   label: 'Email Templates',   icon: Mail,       adminOnly: true },
  { href: '/settings/rejection-reasons', label: 'Rejection Reasons', icon: XCircle,    adminOnly: true },
  { href: '/settings/integrations',      label: 'Integrations',      icon: Plug },
  { href: '/settings/audit-log',         label: 'Audit log',         icon: ListChecks, adminOnly: true },
  { href: '/settings/trash',             label: 'Trash',             icon: Trash2,     adminOnly: true },
  { href: '/settings/billing',           label: 'Billing',           icon: CreditCard, ownerOnly: true },
]
```

No section grouping, no headers — visually flat.

### Existing components (substantial reuse surface)

| Component | Lines | Used at | Notes |
|---|---|---|---|
| `ProfileForm` | 92 | profile | Name, title, email, photo |
| `ChangePasswordForm` | 172 | profile | |
| `MfaPolicyCard` | 113 | organization | `require_mfa` + `require_mfa_for_admins` toggles |
| `OrganizationForm` | 222 | organization | Org name, slug, logo |
| `TeamInvitations` | 235 | team | Members + invites + revoke + MFA reset |
| `CustomFieldsManager` | **592** | custom-fields | Candidate + vacancy toggle, type chips, 20-cap |
| `EmailTemplatesManager` | 292 | email-templates | Category + `{{variable}}` editor |
| `RejectionReasonsManager` | 186 | rejection-reasons | Reasons list |
| `RejectionTemplatesManager` | 294 | rejection-reasons (sub) | Templates linked to reasons |
| `LinkedinConnect` | 119 | integrations | LinkedIn OAuth |
| `AuditLogTable` | 110 | audit-log | |
| `AuditLogFilters` | 153 | audit-log | Filter UI |
| `TrashList` | 376 | trash | |
| `DangerZone` | 149 | organization | Org delete |

### Schema touched

- `profiles` — `full_name`, `job_title`, `language` (planned but absent), `photo_url`, `mfa_enrolled`
- `organizations` — `name`, `slug`, `public_page_slug`, `logo_url`, `require_mfa`, `require_mfa_for_admins`, `deleted_at`
- Auth — Supabase Auth MFA factors
- `team_invitations`, `notifications`, `email_templates`, `rejection_reasons`, `rejection_templates`, `custom_field_*`, `organization_integrations`, `webhook_notifications`, `activity_log`

---

## 2. Proposed redesign

The user-uploaded `Settings.dc.html` confirms the 4-category structure:

```
PERSONAL                  ORGANIZATION              HIRING WORKFLOW           DATA
─ Profile                 ─ Organization            ─ Custom fields           ─ Audit log
─ Notifications  (NEW)    ─ Team                    ─ Email templates         ─ Trash
─ Security      (NEW)     ─ Billing  (← Subscription) ─ Rejection reasons
                                                    ─ Integrations
```

### 2.1 Layout (left nav constant)

```
┌─ Settings ─────────────────────────────────────────┐
│ Settings  ›  Profile                              │
├──────────────┬─────────────────────────────────────┤
│  PERSONAL    │                                     │
│  ● Profile   │  [body for active sub-page]         │
│  ○ Notif…    │                                     │
│  ○ Security  │                                     │
│              │                                     │
│  ORGANIZATION│                                     │
│  ○ Org…      │                                     │
│  ○ Team      │                                     │
│  ○ Billing   │                                     │
│              │                                     │
│  HIRING WF   │                                     │
│  ○ Custom f… │                                     │
│  ○ Email t…  │                                     │
│  ○ Rejection │                                     │
│  ○ Integrat… │                                     │
│              │                                     │
│  DATA        │                                     │
│  ○ Audit log │                                     │
│  ○ Trash     │                                     │
└──────────────┴─────────────────────────────────────┘
```

- Section labels: small-caps, brand-blue
- Nav items: same chip style as today
- Visual grouping replaces flat list

### 2.2 Per-page role gating (unchanged in spirit)

| Sub-page | Visible to | Why |
|---|---|---|
| Profile / Notifications / Security | all | per-user |
| Organization / Team / Billing | owner / admin (mixed today; recommend unify) | org-level |
| Custom fields / Email templates / Rejection reasons / Integrations | admin | hiring workflow config |
| Audit log / Trash | admin | data governance |

**Recommendation:** keep the existing role gates exactly. The redesign doesn't change *who* can see *what*; it just regroups *how* they see it.

### 2.3 Personal → Profile (modify)

Existing `/settings/profile` minus the Two-factor section (moved to new Security page).

Per design: Full name · Job title · Email · Language · Photo. **`language` field** is shown but doesn't exist in current schema — recommend defer (i18n is your Phase 7 in [`docs/1-product/roadmap.md`](../../1-product/roadmap.md)) and grey out / hide for v1.

### 2.4 Personal → Notifications (NEW — locked Q7 contents)

Per the audit, contents were "spec gap". This doc proposes the minimum useful v1:

**Email notifications:**
- ☑ New applicant on my vacancies
- ☑ Interview scheduled with me
- ☑ Offer awaiting response  (recruiter-facing — alerts when a sent offer is going stale)
- ☑ @mention in a candidate note  (G-021)
- ☑ Team invitation update  (someone accepted/declined)
- ☐ Weekly digest of org hiring activity

**In-product notifications:**
- ☑ Show notification bell badge for above events
- ☑ Auto-mark as read when notification is clicked

**Quiet hours (optional):**
- "Don't send email notifications between [22:00] and [07:00] in [my timezone]"

**Persistence:** new column `profiles.notification_preferences JSONB` (or new table `user_notification_preferences`). Lean: JSONB on profiles — simpler, no migration tax.

**Audit gap closed:** Q7 was open in audit §4.10. This is the minimum useful baseline; org-level preferences can be a v2.

### 2.5 Personal → Security (NEW — locked Q8 split)

Per Q8 lock: per-user MFA here, org policy stays at Organization.

Contents:
- **Password:** "Change password" card (lifts `ChangePasswordForm` from today's Profile)
- **Two-factor authentication:**
  - Status badge (enrolled / not enrolled)
  - "Set up two-factor authentication" CTA → opens existing MFA enrollment flow (QR + manual entry secret + verify code)
  - If enrolled: "Remove two-factor" with confirm + password re-entry
- **Active sessions** (v1.1) — list of devices + revoke. Defer to v1.1 unless requested.
- **Login history** (v1.1) — last 10 logins. Defer.

**v1 minimum:** Password card + 2FA card. Two existing components, one new layout.

### 2.6 Organization → Organization (modify, light)

Existing `/settings/organization` minus the MFA policy card (now its own surface? — see Q-S7-c below; or stays here as designed).

Per the user-uploaded design: the **MFA policy card stays on the Organization sub-page** — that's the Q8 lock interpretation. So:

- Organization form: name, careers-page slug, logo (existing `OrganizationForm`)
- **Security policy card:** "Require 2FA for all members" + "Require 2FA for admins" (existing `MfaPolicyCard`)
- Danger zone: delete organization (existing `DangerZone`)

Same content as today; the MFA policy doesn't move. The new Personal → Security page handles per-user enrollment; the org-level policy stays here.

### 2.7 Organization → Team (unchanged content)

Existing `/settings/team` page renders fine. Restyle to match design (avatar + name + role pill + ⋯ menu).

Already includes:
- 3-of-5 seats counter
- Active members
- Pending invites (with "· invited" status indicator)
- MFA reset button per member (G-032 admin recovery)

### 2.8 Organization → Billing (consolidate)

**Today:** `/settings/billing` is a 5-line redirect to `/subscription` (277 LOC). Two routes for one feature.

**Locked:** consolidate into one route at `/settings/billing`. Delete `/subscription`.

Migration: move the 277 LOC from `app/(dashboard)/subscription/page.tsx` → `app/(dashboard)/settings/billing/page.tsx`. Add a redirect from `/subscription` → `/settings/billing` for one release, then remove. No data migration.

Page content (existing in `/subscription`):
- Current plan
- Trial countdown
- Seats used
- Payment method
- Invoices

### 2.9 Hiring workflow group (4 pages, all unchanged content)

| Page | Status | Notes |
|---|---|---|
| Custom fields | KEEP | `CustomFieldsManager` (592 LOC) — entity toggle, 20-cap, type chips |
| Email templates | KEEP | `EmailTemplatesManager` (292 LOC) — category + `{{variable}}` |
| Rejection reasons | KEEP | `RejectionReasonsManager` + `RejectionTemplatesManager` (linked) |
| Integrations | KEEP | `LinkedinConnect` + Google/Zoom/MS panels + webhook + calendly sub-links |

Restyle only. No content change for v1.

### 2.10 Data group (2 pages, unchanged content)

| Page | Status | Notes |
|---|---|---|
| Audit log | KEEP | `AuditLogTable` + `AuditLogFilters` (G-019) |
| Trash | KEEP | `TrashList` (G-020) with 30-day recovery countdown |

Restyle only.

### 2.11 Nav active-state across sections

When viewing a sub-page, the active item highlights and **the section label stays neutral** (don't double-highlight). Active item bg = subtle brand-blue tint (per design).

### 2.12 Mobile (graceful degradation)

Settings is desktop-by-nature per the redesign source. On mobile:
- Section labels render
- Sub-pages stack vertically
- "Back to settings" link inside each sub-page
- Banner: "Settings work best on a larger screen"

Don't over-invest. Simple responsive collapse.

---

## 3. Gaps, missing screens, edge cases

### 3.1 Missing screens

| Surface | Why missing | Recommended action |
|---|---|---|
| First-run profile (just signed up) | Existing | Same; render existing profile form |
| Empty audit log | Existing | Same |
| Empty trash | Existing | Same |
| Settings on mobile | Spec doesn't draw | Per §2.12 |
| Integrations on Calendly OAuth in-flight | Existing | Same |
| Settings 404 (bad sub-path) | Existing 404 | Same |
| Owner deleting org with active subscription | Existing flow has confirmation | Audit + add "you'll lose your subscription" tile if active billing |

### 3.2 Edge cases

| Case | Today | New |
|---|---|---|
| Member tries to view admin-only page | Today: not visible in nav; direct URL returns redirect | Same |
| MFA required but user not enrolled | Middleware AAL gate redirects to enrollment | Same |
| Admin removes MFA from a member who has it required by policy | Policy check at next login forces re-enrollment | Same |
| User's role changes mid-session | Nav re-renders on next navigation | Same |
| Org subscription cancelled (post-Phase 10 billing) | Plan-limit features start failing | Show banner on every Settings page: "Your subscription has expired" |

### 3.3 Race conditions

- Owner edits org name + admin edits org slug simultaneously: last-write-wins. Acceptable.
- Member preferences updated + new event arrives in window: notification respects the at-event-time preference. Tiny race; acceptable.

---

## 4. Reuse opportunities

| Need | Reuse from | Notes |
|---|---|---|
| Section-grouped nav | NEW — replace flat `NAV_ITEMS` with grouped structure | Small refactor of `SettingsNav` |
| Profile form (sans MFA) | `ProfileForm` | Direct (remove MFA section) |
| Change password card | `ChangePasswordForm` | Direct — move to Security page |
| 2FA enrollment card | Existing MFA enrollment UI in `ProfileForm` | Lift into Security page |
| Org form | `OrganizationForm` | Direct |
| MFA policy card | `MfaPolicyCard` | Direct (stays on Organization page) |
| Danger zone | `DangerZone` | Direct |
| Team | `TeamInvitations` | Direct |
| Billing page | `app/(dashboard)/subscription/page.tsx` (277 LOC) | **Move** to `settings/billing/page.tsx` |
| Custom fields | `CustomFieldsManager` (592 LOC) | Direct |
| Email templates | `EmailTemplatesManager` (292 LOC) | Direct |
| Rejection reasons + templates | `RejectionReasonsManager` + `RejectionTemplatesManager` | Direct |
| Integrations panel | Existing integrations page | Direct |
| Audit log | `AuditLogTable` + `AuditLogFilters` | Direct |
| Trash | `TrashList` (376 LOC) | Direct |

**Net new code:**
- Grouped nav structure in `SettingsNav`
- Section label component
- Notifications sub-page (per §2.4)
- Notification preferences server actions + DB column
- Security sub-page layout (composes existing password + MFA cards)
- `/subscription` → `/settings/billing` migration + redirect

---

## 5. DB / API changes

### 5.1 Schema

```sql
-- Notification preferences per user (JSONB on profiles — simpler than a table)
ALTER TABLE public.profiles
  ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{
    "email": {
      "new_applicant": true,
      "interview_scheduled": true,
      "offer_awaiting_response": true,
      "mention": true,
      "team_invite_update": true,
      "weekly_digest": false
    },
    "in_product": {
      "show_bell_badge": true,
      "auto_mark_read": true
    },
    "quiet_hours": null
  }'::jsonb;

-- quiet_hours when set:
--   { "start_local": "22:00", "end_local": "07:00", "timezone": "Europe/Tbilisi" }
```

### 5.2 Server actions

**New:**

- `lib/actions/notifications-preferences.ts::getNotificationPreferences()` — returns current user's prefs
- `lib/actions/notifications-preferences.ts::updateNotificationPreferences(prefs)` — partial-update via JSONB merge

**Modified:**

- `lib/actions/notifications.ts::createOrgNotifications(...)` — read recipient prefs; skip recipient if `email.<event>` is false; apply quiet hours
- `lib/email/sendNotificationEmail(...)` — same prefs check before send

**Unchanged:**

- All organization / team / custom fields / etc. actions

### 5.3 Routes

| Route | Status | Action |
|---|---|---|
| `/settings` | KEEP | Redirect to `/settings/profile` |
| `/settings/profile` | MODIFY | Remove 2FA section (moves to Security) |
| `/settings/notifications` | **NEW** | Per §2.4 |
| `/settings/security` | **NEW** | Per §2.5 |
| `/settings/organization` | KEEP | Visual restyle only; MFA policy card stays |
| `/settings/team` | KEEP | Restyle |
| `/settings/custom-fields` | KEEP | Restyle |
| `/settings/email-templates` | KEEP | Restyle |
| `/settings/rejection-reasons` | KEEP | Restyle |
| `/settings/integrations` | KEEP | Restyle |
| `/settings/integrations/webhooks` | KEEP | Unchanged (G-030 page) |
| `/settings/integrations/calendly` | KEEP | Unchanged (G-031 page) |
| `/settings/audit-log` | KEEP | Restyle |
| `/settings/trash` | KEEP | Restyle |
| `/settings/billing` | **REWORK** | Replace redirect with the actual UI moved from `/subscription` |
| `/subscription` | **REMOVE** (with one-release redirect) | Move content to `/settings/billing`; add 301 redirect during transition |

---

## 6. Effort estimate

### 6.1 Wave 1.2 — Settings regroup (the redesign Wave 1 item)

| Task | Effort | Reuse |
|---|---|---|
| Grouped nav structure in `SettingsNav` | `S` | Refactor existing |
| Section label component | `S` | New small |
| Move 2FA section from Profile → Security | `S` | Lift existing UI |
| New `/settings/security` page composing password + 2FA | `S` | Existing components |
| New `/settings/notifications` page | `S` | New page |
| Notification preferences form | `M` | New form, ~150 LOC |
| `profiles.notification_preferences` migration | `S` | One-line |
| `getNotificationPreferences` + `updateNotificationPreferences` actions | `S` | New |
| Modify `createOrgNotifications` to respect prefs | `S` | Read-check + skip |
| Modify email send to respect prefs + quiet hours | `S` | Same |
| Move `/subscription` content to `/settings/billing` | `S` | Cut + paste |
| Add `/subscription` → `/settings/billing` redirect | `S` | One-line route |
| Restyle each sub-page header to match design | `S` per page × 11 | Mostly CSS |
| Mobile responsive collapse | `S` | CSS |

**Wave 1.2 total: ~M** (2 weeks elapsed). Most of the work is sub-page restyling; the new Notifications + Security pages are small.

### 6.2 Coordination

- Coordinates with **G-032 2FA** — Security page is the new home for per-user enrollment; doesn't change the auth flow
- Coordinates with **G-030 webhooks** — webhook page lives as-is under Integrations
- Coordinates with **Phase 10 billing** — the new `/settings/billing` is the consolidation point for self-serve cancel (F-004 in product roadmap) when billing provider lands
- Coordinates with **Wave 2.5 scorecard** — no overlap, just naming alignment for "Settings" tabs on vacancy detail

---

## 7. Open questions

### 7.1 RESOLVED via locked decisions

| Question | Status |
|---|---|
| 4-category regrouping | ✅ Locked |
| Notifications + Security as new sub-pages | ✅ Locked |
| MFA split (per-user → Security; org policy stays at Organization) | ✅ Q8 |
| Subscription folds into Billing | ✅ Locked |
| Visibility model | ✅ Keep existing role gates |
| Notifications page contents | ✅ Per §2.4 (this doc) |
| Security page contents | ✅ Per §2.5 (this doc) |

### 7.2 NEW — surfaced by this analysis

- **Q-S7-a:** **Member-visible Hiring workflow group** — today `Custom fields / Email templates / Rejection reasons` are admin-only. Should non-admin members see them as read-only (so they understand the templates that drive emails they receive notifications about) or hidden entirely? *Lean: hidden* — matches today's behavior; members don't need to know.
- **Q-S7-b:** **Notification preferences default** — all email events on by default vs all off? *Lean: opted-in (on)* — matches recruiter expectation. Users can turn off granularly.
- **Q-S7-c:** **MFA policy location** — confirmed stays on Organization page (Q8 lock interpretation). But should it be promoted to its own "Security" sub-page at the org level (parallel to per-user Security)? *Lean: stay on Organization* — adds a sub-page for one card; not worth the IA complexity.
- **Q-S7-d:** **`language` field in Profile form** — show greyed-out "Coming with multi-language UI (i18n, Phase 7)" or omit entirely? *Lean: omit for v1* — design shows the field but the i18n work isn't here yet.
- **Q-S7-e:** **Quiet hours** — ship in v1 or v1.1? *Lean: v1.1* — adds timezone-aware delivery logic; v1 = simple on/off per event type.
- **Q-S7-f:** **Active sessions + login history on Security page** — v1 or v1.1? *Lean: v1.1* — Supabase Auth has the session list but exposing it requires UI + revoke action; defer.
- **Q-S7-g:** **`/subscription` redirect duration** — how long does the redirect from `/subscription` → `/settings/billing` stay? *Lean: 6 months* — generous window for any external links/bookmarks to update.
- **Q-S7-h:** **Notifications sub-page visibility for members** — members get fewer event types (e.g. no "Offer awaiting response" since they don't send offers); UI hides irrelevant rows or shows them disabled? *Lean: hide* — cleaner UX.

---

## 8. Test plan

### 8.1 Functional — nav

- [ ] All 4 section labels render (Personal / Organization / Hiring workflow / Data)
- [ ] Sub-pages render under correct section
- [ ] Active sub-page highlighted; section label stays neutral
- [ ] Owner sees all sub-pages
- [ ] Admin sees all except Billing (per existing rule)
- [ ] Member sees only Personal + Integrations
- [ ] Default redirect `/settings` → `/settings/profile`

### 8.2 Functional — Profile

- [ ] Profile form renders + saves
- [ ] No 2FA section visible (moved to Security)
- [ ] Change password section absent (moved to Security)
- [ ] `language` field per Q-S7-d decision

### 8.3 Functional — Notifications (NEW)

- [ ] All 6 email events + 2 in-product toggles render
- [ ] Default state per Q-S7-b (all email on)
- [ ] Toggle changes persist
- [ ] `createOrgNotifications` skips recipient when their toggle is off
- [ ] `sendNotificationEmail` skips when toggle off
- [ ] Quiet hours per Q-S7-e (v1: omit; v1.1: form + delivery logic)
- [ ] Member sees fewer event types per Q-S7-h

### 8.4 Functional — Security (NEW)

- [ ] Change password card works (existing component)
- [ ] 2FA enrollment card shows current state
- [ ] Enroll flow: QR + manual secret + verify code
- [ ] Remove 2FA flow with password re-entry
- [ ] Banner if org requires MFA but user isn't enrolled
- [ ] Active sessions / login history per Q-S7-f decision

### 8.5 Functional — Organization

- [ ] Org form renders + saves (existing)
- [ ] MFA policy card renders + toggles (existing — Q8 lock)
- [ ] Danger zone delete works (existing)

### 8.6 Functional — Billing consolidation

- [ ] `/settings/billing` renders the actual billing UI (not a redirect)
- [ ] `/subscription` → `/settings/billing` redirect (301)
- [ ] All existing billing functionality preserved
- [ ] Removal of `/subscription` after Q-S7-g window

### 8.7 Regression

- [ ] All 4 hiring-workflow sub-pages render identically to today
- [ ] All 2 data sub-pages render identically to today
- [ ] G-019 audit log filters still work
- [ ] G-020 trash 30-day countdown still works
- [ ] G-030 webhooks page still works
- [ ] G-031 Calendly OAuth still works
- [ ] G-032 admin MFA reset from Team page still works
- [ ] Plan-limit checks on Team / Custom fields still work

---

## 9. Verification

Aligned with [`docs/claude-code-workflow.md`](../../claude-code-workflow.md) Phase 5:

- [ ] All sub-tasks in §6 complete
- [ ] Tests in §8 pass
- [ ] Docs updated:
  - [ ] `docs/3-architecture/frontend.md` — settings nav structure
  - [ ] `docs/3-architecture/backend.md` — notification preferences actions
  - [ ] `docs/3-architecture/database.md` — `profiles.notification_preferences` column
  - [ ] `docs/2-business/roles-permissions.md` — confirm role-gate logic unchanged
  - [ ] `docs/4-integrations/google.md`, `zoom.md`, `microsoft.md`, `linkedin.md`, `calendly.md`, `webhooks.md` — confirm settings page references
  - [ ] `docs/5-environment/variables.md` — no new env vars
  - [ ] `docs/8-decisions.md` — Q-S7-a through Q-S7-h decisions
  - [ ] `docs/ui-texts.md` — new copy
- [ ] Ripple check — all notification senders read prefs before sending

---

## 10. What to do after reading

1. **Confirm Q-S7-a through Q-S7-h** (or override).
2. **Decide Q-S7-d** (language field — biggest design difference vs spec) — quick decision.
3. **Decide Q-S7-e** (quiet hours v1 vs v1.1) — affects effort estimate.
4. **Next flow doc:** S8 Reports (~3000 words, mostly polish — funnel + time-to-hire + sources). Then S10 AI/terminology (closes the corpus).

---

## Appendix — file inventory for this flow

**New files:**

| File | Purpose |
|---|---|
| `app/(dashboard)/settings/notifications/page.tsx` | New |
| `app/(dashboard)/settings/security/page.tsx` | New |
| `components/settings/notification-preferences-form.tsx` | New |
| `components/settings/security-summary.tsx` | New (composes password + MFA cards into one page) |
| `components/settings/section-label.tsx` | New (small nav section header) |
| `lib/actions/notification-preferences.ts` | New |
| `scripts/054_profiles_notification_preferences.sql` | New migration |

**Modified files:**

| File | Change |
|---|---|
| `components/settings/settings-nav.tsx` | Refactor to grouped structure |
| `app/(dashboard)/settings/profile/page.tsx` | Remove 2FA + password sections (moved) |
| `components/settings/profile-form.tsx` | Same — slimmer form |
| `app/(dashboard)/settings/billing/page.tsx` | Replace 5-line redirect with full billing UI moved from `/subscription` |
| `lib/actions/notifications.ts::createOrgNotifications` | Respect recipient prefs |
| `lib/email/notification-email.ts` (or wherever) | Same |

**Moved files:**

| File | From → To |
|---|---|
| `app/(dashboard)/subscription/page.tsx` (277 LOC) | → `app/(dashboard)/settings/billing/page.tsx` |
| `/subscription` route | → 301 redirect to `/settings/billing` for ~6 months |

**Retained as-is:**

| File | Note |
|---|---|
| `OrganizationForm`, `MfaPolicyCard`, `DangerZone` | All stay on `/settings/organization` |
| `TeamInvitations` | Stays on `/settings/team` |
| `ChangePasswordForm` | Moves to `/settings/security` |
| `CustomFieldsManager`, `EmailTemplatesManager`, `RejectionReasonsManager`, `RejectionTemplatesManager` | All unchanged |
| `LinkedinConnect` and integration sub-pages | All unchanged |
| `AuditLogTable`, `AuditLogFilters`, `TrashList` | All unchanged |

**Docs touched:**
- `docs/3-architecture/frontend.md`
- `docs/3-architecture/backend.md`
- `docs/3-architecture/database.md`
- `docs/2-business/roles-permissions.md`
- `docs/4-integrations/*.md` (page-reference updates only)
- `docs/8-decisions.md`
- `docs/ui-texts.md`

**Tests added:**
- `tests/components/settings/settings-nav.test.tsx` — grouped structure + role gating
- `tests/components/settings/notification-preferences-form.test.tsx`
- `tests/components/settings/security-summary.test.tsx`
- `tests/lib/actions/notification-preferences.test.ts`
- `tests/lib/actions/notifications-prefs-respected.test.ts` — `createOrgNotifications` skips opted-out
