# HRHandle — Product Roadmap

_Last updated: 2026-06-15_
_Owner: Aleksandre Merabishvili_

This is the single index of work that's **not yet built but worth building**. It groups everything in one place so future-you (or a contributor) doesn't have to triangulate across `issues-found.md`, `ai-features.md`, and Slack/notes.

**How to use this doc.** Each item links out to the doc where its detail lives (compliance, audit, architecture). New items get added here first. When work ships, move the row to the "Recently shipped" section at the top and link the PR/commit. Quarterly review: prune stale items, re-prioritize the rest.

The roadmap is intentionally opinionated — it includes items that are tracked, items that are postponed for billing, and **ATS gaps that nobody has filed yet** but a serious recruiter will notice. Items have a status tag so you can scan:

- 🟢 **Ready** — scoped enough to start; no external blocker
- 🟡 **Blocked** — waiting on something concrete (billing, framework, decision)
- ⚪ **Idea** — not scoped yet; one-line description is the entire spec right now

---

## Recently shipped (post-audit)

A short tour so context for the rest of the roadmap is fresh.

| Area | Shipped | What |
|---|---|---|
| AI features | G-009 → G-015 | Candidate summary, JD generator, interview questions, note-extractor, inclusive-language check, assessment suggester, email drafter. Six design principles in [ai-features.md](../9-compliance/ai-features.md). |
| Candidate experience | G-016, G-017, **G-018** | Public `/status/<token>` page (abstracted Applied/In review/Interview/Decision/Closed buckets), opt-in auto-emails on screening/interview transitions, **and now the full offer process: structured-but-minimal `offers` table, recruiter panel inside each application row, candidate `/offer/<token>` Accept/Decline page that flows accept into the existing `hired` pipeline path**. |
| Compliance | G-001 → G-008 | Gemini paid tier, Article 13 notice, 30-day purge cron, breach playbook, ROPA, OAuth revoke, self-serve org delete, sign-up country gate. |
| Polish | F-009, BL-006, BL-007 | List pagination controls + page-size selector, dashboard loading skeletons, candidate-delete cascade + accurate confirmation. |

---

## Big features

These are large enough that each will be its own multi-PR effort. Each one has a sketch but not a finalized design.

### ✅ Offer process — shipped 2026-06-15 (G-018)

Phase 2 of the candidate-facing experience. Moved from "Big features" to "Recently shipped" — see the table above. Sub-features deferred to a future PR:

- **PDF offer letter generation** — the in-product HTML email + candidate offer page cover the common cases; PDF is v2 if customers ask.
- **E-signature** (DocuSign / Dropbox Sign) — v2.
- **Counter-offer / negotiation flow** — v2; today's revision path is withdraw + create new.
- **Per-org saved offer template** — v2; recruiters duplicate an old offer in the meantime.
- **AI-assisted offer drafting** — would build on the existing AI email drafter pattern; v2.

### 🟡 Multi-language UI (i18n)

HRHandle's interface is English-only today. There's zero i18n plumbing — no `next-intl`, no locale routing under `app/[locale]/...`, no translation files. The candidate `languages` field is unrelated (it captures which languages the *candidate* speaks).

Strategy when it's time:

- **Library choice**: `next-intl` is the standard for Next.js App Router. ICU MessageFormat for plurals/dates.
- **Catalogue extraction**: all user-visible strings currently live inline in `.tsx`. A first pass would need a string-extraction sweep (this is the bulk of the work — probably 2–3K strings).
- **Locale storage**: per-user (`profiles.locale`) + per-org default for the public surfaces (apply form, status page).
- **Public surfaces first**: localize `/apply/[token]` and `/status/[token]` first — those are read by candidates who didn't choose to use HRHandle, and they're the smallest surfaces.
- **Start languages**: probably Georgian + Russian + Turkish + Spanish first (matching the founder's market focus). English is the source language.
- **No translation of customer content**: vacancy bodies, candidate notes, etc. stay in whatever language the recruiter typed.

Blocked on: a decision about which markets to launch in. Until then the work just bloats every PR.

### 🟡 AI screening

Already documented as planned in [ai-features.md](../9-compliance/ai-features.md#planned-features-not-yet-shipped): applicant list per vacancy with advisory fit indicators per candidate, never changes candidate state automatically.

Blocked on: building the EU AI Act risk-management framework for higher-risk features (the current six AI features sit under the "low-risk advisory" framing; screening crosses into Annex III "high-risk" with a much heavier obligation set).

### 🟢 Restore-from-trash UI (F-011 follow-up)

Migration 030 added `restored_at` + `restored_by` columns to `candidates` and `vacancies` but the restore action was never wired because there's no admin UI to call it from. The BL-007 PR also carries `application_ids` in the candidate-delete audit log so a future restore can scope its cascade.

Scope:
- `/settings/trash` admin page listing soft-deleted candidates + vacancies in the org (newest first).
- "Restore" button per row → server action sets `deleted_at = NULL`, populates `restored_at` / `restored_by`. For candidates, also unsets `deleted_at` on the application rows recorded in the candidate-delete audit row.
- Hard-delete-now button as an opt-out of the 30-day grace period.

Track at: F-011 in [issues-found.md](../issues-found.md).

### 🟢 Audit-log viewer UI

The `activity_log` table is populated by `writeAuditLog` from every status change, AI invocation, OAuth connect/disconnect, candidate delete, org delete, etc. (F-002 + G-009 + many others wired this). **No UI exists** to read it.

Scope:
- `/settings/audit-log` admin page with filters (entity type, action, user, date range).
- Plain table view; export to CSV for compliance reviews.
- Read-only, owner/admin role.

Track at: this row (no audit item — the data plumbing is done, this is just the viewer).

---

## Tracked open items

Live items from [issues-found.md](../issues-found.md). All are postponed for non-engineering reasons.

| ID | Title | Why parked |
|---|---|---|
| F-004 | Cancel-subscription UI | 🟡 Blocked — needs billing provider wiring (LemonSqueezy planned) |
| BL-004 | `PLAN_LIMIT` error code + upgrade CTA | 🟡 Blocked — same reason |
| C-007 / C-008 | Move hardcoded plan limits + campaign config out of code | 🟡 Blocked — shape depends on what the billing provider exposes |
| C-012 / A-007 | Strict tsconfig (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | 🟡 Blocked — 87 errors across ~40 files; dedicated cleanup PR needed |
| AC-012 | WCAG accessibility audit | 🟡 Blocked — needs browser-based contrast measurement on every status palette in light + dark |
| A-002 / A-005 | Component splits (`candidates/page.tsx`, `vacancy-form.tsx`) | 🟡 Blocked — naive splits would regress maintainability; needs form-library migration first |

---

## ATS gaps (not yet tracked anywhere)

Real features competing ATSes have that HRHandle does not. Some are 1–2 day wins; others are full epics. None are filed in `issues-found.md` yet — list them here, promote to roadmap items when they get scoped.

### Workflow

- ⚪ **Bulk operations beyond batch reject** — bulk move-to-stage, bulk assign to a vacancy, bulk add tags.
- ⚪ **Global search** across candidates / vacancies / notes from any page (cmd-K).
- ⚪ **Saved filters / smart lists** — recruiter saves a filter combination ("Frontend engineers in Tbilisi") as a named view.
- ⚪ **Internal @-mentions in notes** — notify the named teammate (uses the existing notifications table).
- ⚪ **CSV import** — bulk candidate import to complement the existing CSV export.
- ⚪ **Reference checks workflow** — request, collect, store references against a candidate.
- ⚪ **Scorecard sharing** — share a candidate's evaluation scorecard with a hiring manager who isn't an HRHandle user (token-based read-only link, mirrors G-016 pattern).
- ⚪ **Candidate withdraw button** on `/status/[token]` — currently only the recruiter can withdraw an application.

### Reporting

- ⚪ **Time-to-hire** per vacancy / per role family / per recruiter.
- ⚪ **Source effectiveness** — which sources (public form, LinkedIn, manual, referrals) produce the most hires.
- ⚪ **Pipeline conversion** — applied → screening → interview → offer → hired funnel per vacancy.
- ⚪ **Recruiter productivity** — applications reviewed / week, evaluations completed / week.

### Integrations

- ⚪ **Slack / Teams notifications** — org-level webhook for events (new application, candidate hired, interview scheduled).
- ⚪ **Calendly / Cal.com integration** — candidate self-serve interview scheduling once the recruiter advances them to "Interview".
- ⚪ **Email tracking** — open/click tracking on recruiter-sent emails (Resend supports it; needs a toggle in `/settings/email-templates`).
- ⚪ **LinkedIn job auto-cross-post** — current LinkedIn integration is page-post only; v2 would be cross-posting to Jobs.

### Identity

- ⚪ **2FA / TOTP** for recruiter accounts.
- ⚪ **SSO (SAML)** for enterprise customers.

### Operational polish

- ⚪ **Audit-log viewer UI** — see Big Features above.
- ⚪ **Restore-from-trash UI** — see Big Features above.
- ⚪ **Per-org default page size** in `profiles.column_preferences` (F-009 follow-up).
- ⚪ **Mobile-responsive polish** on detail pages — most pages are responsive but the vacancy/candidate detail layouts are designed desktop-first.

---

## Tech debt (deferred, accepted)

Listed here for memory, not action. See [issues-found.md](../issues-found.md) for the deferral rationale on each.

- Keyset / cursor pagination (F-009 follow-up) — re-investigate when an org passes ~5K rows.
- `count: 'planned'` instead of `count: 'exact'` on the list queries — same trigger.
- Switch to `react-hook-form` so the vacancy/candidate forms can be split into smaller components (A-005).
- Subscription / billing tech debt (C-007, C-008) — see the billing PR when it exists.

---

## Execution sequence

Sorted top-down. Each phase is self-contained — finish it before starting the next, except where noted. Billing is intentionally last.

Two cross-cutting rules:
- **Always-on**: keep `docs/issues-found.md` audit hygiene up to date; any new bug found mid-phase gets a row.
- **WCAG audit (AC-012) and strict tsconfig cleanup (C-012/A-007)** are tech-debt items that can be interleaved opportunistically — don't wait for a dedicated phase.

### Phase 1 — Operational completeness (finish what's plumbed)

Small effort, real value because the data plumbing already exists.

1. **Audit-log viewer UI** (`/settings/audit-log`) — `activity_log` is already written to from every meaningful action; this just exposes it. ~1 day. Compliance + admin trust win.
2. **Restore-from-trash UI** (`/settings/trash`) — `restored_at` / `restored_by` columns exist (migration 030). BL-007 left `application_ids` in the candidate-delete audit row so restore can cascade. ~2 days.
3. **Email tracking toggle** — Resend supports opens/clicks; expose as a per-org switch on `/settings/email-templates`. ~half day.

### Phase 2 — Offer process ✅ shipped 2026-06-15 (G-018)

Shipped as a single PR rather than the originally-sketched four-step rollout: schema (migration 035) + state-machine + actions + recruiter panel + candidate `/offer/<token>` page + auto-expire cron + audit logging all bundled together. PDF generation, e-signature, counter-offer flow, per-org template, and AI assist remain v2.

### Phase 3 — Recruiter productivity (ATS table-stakes)

Things competitors have. Order by easy-to-hard:

1. **Email tracking** *(if not done in Phase 1)*.
2. **Internal @-mentions** in candidate notes + interview notes. Reuses the existing `notifications` table.
3. **Candidate withdraw button** on `/status/[token]` — G-016 follow-up. Tiny.
4. **Global search** (cmd-K) across candidates / vacancies / notes. Postgres full-text on the existing columns.
5. **Bulk operations beyond batch reject** — bulk move-to-stage, bulk add tags. Extends the existing selection-state pattern.
6. **Saved filters / smart lists** — recruiter saves a filter combination as a named view. New `saved_views` table.
7. **CSV import** — bulk candidate import to mirror the existing CSV export.
8. **Scorecard sharing** — token-based read-only link to a candidate's evaluation, for hiring managers who aren't HRHandle users.

### Phase 4 — Reporting

Analytics for recruiters and managers. The data exists; this is just queries + charts. Order by value:

1. **Pipeline conversion** — applied → screening → interview → offer → hired funnel per vacancy.
2. **Time-to-hire** per vacancy / per role family / per recruiter.
3. **Source effectiveness** — which sources (public form, LinkedIn, manual, referrals) produce the most hires.
4. *(Deliberately skip "recruiter productivity" metrics for now — feels surveillance-y for a small team.)*

### Phase 5 — Integrations

Where customers want HRHandle to plug in. Order by user demand × build effort:

1. **Slack / Teams notifications** — org-level webhook for events. Builds on the existing `createOrgNotifications` plumbing.
2. **Calendly / Cal.com integration** — candidate self-serve interview scheduling once the recruiter advances them to "Interview".
3. **LinkedIn jobs auto-cross-post** — extends the existing LinkedIn page-post integration.
4. **Reference checks workflow** — request, collect, store references against a candidate.

### Phase 6 — Identity & SSO

Required for enterprise sales.

1. **2FA / TOTP** for recruiter accounts. Supabase Auth supports MFA — opt-in per user, mandatory per org for owner/admin roles.
2. **SSO (SAML)** for enterprise customers — needs WorkOS or Auth0 integration.

### Phase 7 — Multi-language UI (i18n)

Decoupled from the rest. Triggered by a market-launch decision. Strategy already sketched at the top of "Big features".

Sub-sequence when it lands:
1. `next-intl` setup + locale routing.
2. Public surfaces first — `/apply/[token]` and `/status/[token]`.
3. Recruiter dashboard surfaces.
4. Email templates.

### Phase 8 — AI screening

Blocked on the EU AI Act risk-management framework for higher-risk features. Don't start until that framework exists.

### Phase 9 — Tech debt (one focused PR pass)

When other phases are in flight, batch:
1. WCAG accessibility audit (AC-012) — browser-based contrast measurement.
2. Strict tsconfig (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) — 87 errors across ~40 files; needs a dedicated cleanup PR.
3. Component splits (A-002, A-005) — bundle with a `react-hook-form` migration.
4. Keyset / cursor pagination (F-009 follow-up) — only when an org passes ~5K rows.

### Phase 10 — Billing & subscription

**Intentionally last.** Until billing is wired, every billing-adjacent item stays parked.

1. **Billing provider wiring** — LemonSqueezy (already documented in `docs/4-integrations/lemonsqueezy.md`) or Stripe.
2. **F-004 — Cancel subscription UI** with confirmation flow.
3. **BL-004 — `PLAN_LIMIT` structured error code + upgrade CTA** on every plan-limited action.
4. **C-007 / C-008 — Move hardcoded plan limits + campaign config out of code** into a DB-backed plans table.
5. **Self-serve upgrade flow** with prorated billing changes.

---

## Changelog

| Date | Change | Reviewer |
|---|---|---|
| 2026-06-14 | Initial creation. Pulled in the AI features bundle, candidate-facing experience bundle, compliance work, and the polish PRs as "recently shipped". Recorded offer process + multi-language UI as the founder's top two new ideas. Listed common ATS gaps that nobody has filed yet. | Aleksandre Merabishvili |
| 2026-06-14 | Added "Execution sequence" section with ten phases. Phase 1 (operational completeness) → Phase 2 (offer process) → Phases 3–5 (productivity, reporting, integrations) → Phase 6 (identity) → Phase 7 (i18n, decoupled) → Phase 8 (AI screening, blocked) → Phase 9 (tech debt) → Phase 10 (billing, intentionally last). | Aleksandre Merabishvili |
| 2026-06-15 | Phase 2 (offer process / G-018) shipped. Moved from "Big features" + "Phase 2" into "Recently shipped". V2 sub-features (PDF, e-signature, counter-offer, per-org template, AI drafting) documented as deferred. | Aleksandre Merabishvili |
