# HRHandle — Product Roadmap

_Last updated: 2026-06-23_
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
| AI features | G-009 → G-014 | Candidate summary, JD generator, interview questions, note-extractor, inclusive-language check, assessment suggester. G-015 email drafter shipped 2026-06-09 then retired 2026-06-21 (founder removed it — recruiter-managed templates already covered the real customer-facing email needs). Six design principles in [ai-features.md](../9-compliance/ai-features.md). |
| Candidate experience | G-016, G-017, G-018, G-022 | Public `/status/<token>` page (abstracted Applied/In review/Interview/Decision/Closed buckets), opt-in auto-emails on screening/interview transitions, full offer process: structured-but-minimal `offers` table, recruiter panel inside each application row, candidate `/offer/<token>` Accept/Decline page that flows accept into the existing `hired` pipeline path, **candidate self-withdraw** button on the status page (G-022) that cancels any active offer and notifies the recruiter. |
| Operational completeness | G-019, G-020 | `/settings/audit-log` viewer (filters + CSV export over the populated-but-previously-unreachable `activity_log` table) and `/settings/trash` (restore + hard-delete-now for soft-deleted candidates and vacancies; candidate restore cascades the applications back using the IDs captured in the candidate-delete audit row from BL-007). |
| Recruiter productivity | G-021, G-023, G-024, G-025, G-026, **G-028** | @-mentions in candidate notes; global cmd-K search; bulk move-to-stage; scorecard sharing via token-gated `/scorecard/<token>`; saved filter views per-recruiter on candidates + vacancies lists (G-026); **bulk CSV candidate import** (G-028) — admin-only `/candidates/import` wizard with downloadable template, auto column-mapping, preview with per-row validation errors, skip-duplicate-emails by default, downloadable error CSV, 1000-row/5MB caps, audit-logged as `candidates_imported`. |
| Compliance | G-001 → G-008 | Gemini paid tier, Article 13 notice, 30-day purge cron, breach playbook, ROPA, OAuth revoke, self-serve org delete, sign-up country gate. |
| Reporting | **G-029** | **Reports page** with three sub-tabs: **Pipeline conversion** funnel (applied → screening → interview → offer → hired with stage-to-stage rates), **Time to hire** (median + p25/p75 across hired applications, per-vacancy breakdown), **Source effectiveness** (applications / hires / conversion grouped by `source_type`). Period selector with 7/30/90/365-day + all-time presets. Visible to every signed-in member. Migration 039 backfills `applications.source_type = 'manual'` on existing NULLs + sets DEFAULT 'manual'. Recharts for the funnel bar chart. |
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
- **AI-assisted offer drafting** — v2 if customers ask. The AI email drafter pattern (G-015) was retired before this would have shipped, so a future iteration starts from scratch.

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

### ✅ Restore-from-trash UI — shipped 2026-06-16 (G-020)

Moved to "Recently shipped". Replaces the F-011 follow-up.

### ✅ Audit-log viewer UI — shipped 2026-06-16 (G-019)

Moved to "Recently shipped".

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

- ⚪ **Bulk operations beyond batch reject** — bulk add tags + bulk assign to a vacancy (bulk move-to-stage shipped 2026-06-19 as G-024).
- ✅ Global search across candidates / vacancies / notes (cmd-K) — shipped 2026-06-18 as G-023.
- ✅ Saved filters / smart lists — shipped 2026-06-21 as G-026.
- ✅ Internal @-mentions in notes — shipped 2026-06-17 as G-021.
- ✅ CSV import — shipped 2026-06-22 as G-028. Admin-only `/candidates/import` wizard with downloadable template, auto column-mapping, preview, skip-duplicate-emails, downloadable error report.
- ⚪ **Reference checks workflow** — request, collect, store references against a candidate.
- ✅ Scorecard sharing — shipped 2026-06-20 as G-025.
- ✅ Candidate withdraw button on `/status/[token]` — shipped 2026-06-17 as G-022.

### Reporting

- ✅ Time-to-hire — shipped 2026-06-23 as part of G-029. Median + p25/p75 + per-vacancy breakdown. Per-recruiter breakdown deliberately skipped.
- ✅ Source effectiveness — shipped 2026-06-23 as part of G-029. Applications / hires / conversion grouped by `source_type` (manual, public_form, etc).
- ✅ Pipeline conversion — shipped 2026-06-23 as part of G-029. Cumulative funnel with stage-to-stage conversion rates.
- ⏭️ **Recruiter productivity** — deliberately skipped per Phase 4 plan (feels surveillance-y for a small team).

### Integrations

- ⚪ **Slack / Teams notifications** — org-level webhook for events (new application, candidate hired, interview scheduled).
- ⚪ **Calendly / Cal.com integration** — candidate self-serve interview scheduling once the recruiter advances them to "Interview".
- ⚪ **Email tracking** — open/click tracking on recruiter-sent emails (Resend supports it; needs a toggle in `/settings/email-templates`).
- ⚪ **LinkedIn job auto-cross-post** — current LinkedIn integration is page-post only; v2 would be cross-posting to Jobs.

### Identity

- ⚪ **2FA / TOTP** for recruiter accounts.
- ⚪ **SSO (SAML)** for enterprise customers.

### Operational polish

- ✅ Audit-log viewer UI — shipped (G-019).
- ✅ Restore-from-trash UI — shipped (G-020).
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

### Phase 1 — Operational completeness ✅ partially shipped 2026-06-16

1. ✅ **Audit-log viewer UI** (`/settings/audit-log`) — shipped as G-019.
2. ✅ **Restore-from-trash UI** (`/settings/trash`) — shipped as G-020.
3. ⏭️ **Email tracking toggle** — deferred. Investigation: Resend configures open/click tracking per-domain via their dashboard, not per `emails.send` call. A per-org in-product toggle without two-domain infra (one tracked, one untracked, switching the `from:` address based on the flag) would be misleading — the "off" state couldn't actually disable tracking. Defer until either (a) a customer asks and we provision the two-domain setup, or (b) Resend ships per-send tracking controls.

### Phase 2 — Offer process ✅ shipped 2026-06-15 (G-018)

Shipped as a single PR rather than the originally-sketched four-step rollout: schema (migration 035) + state-machine + actions + recruiter panel + candidate `/offer/<token>` page + auto-expire cron + audit logging all bundled together. PDF generation, e-signature, counter-offer flow, per-org template, and AI assist remain v2.

### Phase 3 — Recruiter productivity (ATS table-stakes)

Order: easy-to-hard.

1. ⏭️ Email tracking — deferred (see Phase 1).
2. ✅ Internal @-mentions in candidate notes — shipped 2026-06-17 as G-021. Interview notes share the same `candidate_notes` row so they benefit automatically.
3. ✅ Candidate withdraw button on `/status/[token]` — shipped 2026-06-17 as G-022.
4. ✅ Global search (cmd-K) — shipped 2026-06-18 as G-023. Uses `ilike` rather than full-text; upgrade path to FTS documented in `lib/search/query.ts` for when an org passes ~5K rows.
5. ✅ Bulk move-to-stage — shipped 2026-06-19 as G-024. Bulk-add-tags still on the list under "Workflow" ATS gaps below.
6. ✅ Saved filters / smart lists — shipped 2026-06-21 as G-026. Per-user; cross-org sharing deferred to a v2.
7. ✅ CSV import — shipped 2026-06-22 as G-028. Admin-only `/candidates/import` wizard, downloadable template, auto column-mapping, preview, skip-duplicate-emails, per-row error CSV, 1000-row/5MB caps. Plan-cap respected per-batch.
8. ✅ Scorecard sharing — shipped 2026-06-20 as G-025. Third token-page (status, offer, scorecard) all using the same admin-client + 404-not-deleted risk model.

### Phase 4 — Reporting ✅ shipped 2026-06-23 (G-029)

1. ✅ **Pipeline conversion** — funnel applied → screening → interview → offer → hired with stage-to-stage rates.
2. ✅ **Time-to-hire** — median + p25/p75 + per-vacancy breakdown. Per-recruiter breakdown deliberately skipped.
3. ✅ **Source effectiveness** — applications / hires / conversion grouped by `source_type`.
4. ⏭️ Recruiter productivity — deliberately skipped (surveillance-y for a small team).

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
| 2026-06-16 | Phase 1 partially shipped: audit-log viewer (G-019) + restore-from-trash UI (G-020). Email-tracking toggle (1.3) deferred — Resend tracking is domain-level, not per-send, so an in-product toggle without two-domain infra would be misleading. | Aleksandre Merabishvili |
| 2026-06-17 | Phase 3 bundle A shipped: @-mentions in candidate notes (G-021) + candidate self-withdraw on the status page (G-022). Phase 3 next item is global search (cmd-K). | Aleksandre Merabishvili |
| 2026-06-18 | Phase 3.4 shipped: global cmd-K search across candidates / vacancies / notes (G-023). Uses `ilike` rather than tsvector — FTS upgrade path is documented for when an org passes ~5K rows. | Aleksandre Merabishvili |
| 2026-06-19 | Phase 3.5 shipped: bulk move-to-stage on the vacancy applications toolbar (G-024). Bulk-add-tags + bulk-assign-to-vacancy remain on the ATS gaps list for later. | Aleksandre Merabishvili |
| 2026-06-20 | Phase 3.8 shipped: scorecard sharing via token-gated `/scorecard/<token>` (G-025). Third token-page in a row using the same admin-client + 404-not-deleted risk model as G-016 status and G-018 offer. Remaining Phase 3 items: 3.6 saved filters, 3.7 CSV import. | Aleksandre Merabishvili |
| 2026-06-21 | Phase 3.6 shipped: saved filter views per-recruiter-per-list-kind on the candidates and vacancies list pages (G-026). Cross-org sharing deferred. Last Phase 3 item is 3.7 CSV import. | Aleksandre Merabishvili |
| 2026-06-22 | Phase 3.7 shipped: bulk CSV candidate import (G-028). Admin-only `/candidates/import` page with multi-step wizard, downloadable template, auto-mapped columns, preview with validation errors, skip-duplicate-emails, downloadable error CSV report. 1000 rows / 5MB caps. Plan-cap enforced once per batch. No new schema. Phase 3 (Recruiter productivity) is now complete. Next: Phase 4 (Reporting). | Aleksandre Merabishvili |
| 2026-06-23 | Phase 4 shipped: Reports (G-029). New `/reports` route with three sub-tabs — pipeline conversion funnel, time-to-hire stats + per-vacancy breakdown, source effectiveness. Period selector (7/30/90/365 days + all-time). Migration 039 backfills `applications.source_type = 'manual'` on existing NULLs + sets DEFAULT 'manual' for future inserts. Recharts added (~80KB) for the funnel bar chart. 40 unit tests on the four pure helpers (period, funnel, time-to-hire, source-summary). Recruiter productivity deliberately skipped. Next: Phase 5 (Integrations). | Aleksandre Merabishvili |
