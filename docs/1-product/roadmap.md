# HRHandle — Product Roadmap

_Last updated: 2026-07-20_
_Owner: Aleksandre Merabishvili_

> **Current outstanding work + manual steps:** [`outstanding-2026-07.md`](outstanding-2026-07.md) — what's left after the 2026-07-03/04 fix batch (4 deferred code tasks + the manual migration / Azure / org-rename steps).
> **See also:** [`docs/redesign/roadmap.md`](../redesign/roadmap.md) — the standalone roadmap for the proposed UX/IA redesign. Independent of this doc; coordination notes flag overlaps where redesign waves touch Phase 9 / Phase 10 items.

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
| Integrations | **G-030, G-031** | **Slack + Teams notifications** (G-030) via per-org incoming webhooks at `/settings/integrations/webhooks` — admins paste a webhook URL, choose from 8 events (application received / hired / rejected / withdrawn, offer sent / accepted / declined, interview scheduled), test message button, per-webhook on/off. Fan-out is best-effort, audit-logged once per dispatch (no payload body retained). **Calendly** (G-031) via OAuth at `/settings/integrations/calendly` — admin connects, HRHandle subscribes to user-scoped webhooks at connect time and stores the HMAC signing key, admin picks one Calendly event type. Recruiter on any candidate page generates a UTM-tagged scheduling URL via the "Calendly link" button; when the candidate books, the webhook receiver verifies the HMAC, creates an interview row, and fans out a Slack/Teams notification. Migrations 040 (`webhook_notifications`) and 041 (Calendly fields on `organization_integrations`). New `CALENDLY_CLIENT_ID` / `CALENDLY_CLIENT_SECRET` env vars. Manual deployment steps in `docs/4-integrations/phase-5-manual-steps.md`. |
| Identity | **G-032** | **2FA / TOTP** at `/settings/profile` — enroll any TOTP app (Google Authenticator, 1Password, Authy), QR code + manual-entry secret from Supabase Auth, post-login challenge at `/auth/mfa-challenge`. Owner can require 2FA org-wide or for owners/admins only via the policy card on `/settings/organization`. Middleware gates dashboard routes: enrolled-but-aal1 → challenge page; required-but-unenrolled → profile page with sticky banner. Admin recovery: small "Reset 2FA" button on `/settings/team` clears a teammate's factors (audit-logged). Migration 042 (`organizations.require_mfa`, `organizations.require_mfa_for_admins`, `profiles.mfa_enrolled`). 22 unit tests. WebAuthn + SAML SSO deferred. |
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

### ✅ AI screening → shipped as AI Fit Analysis (2026-07-22, opt-in default OFF)

The "AI screening" concept shipped as **AI Fit Analysis** (redesign Wave 3.1). Rather than an applicant-list fit column, it is a per-application advisory card on the candidate profile: "Meets N of M must-haves" (no overall score), evidence-based, with mandatory recruiter Agree/Override. It is default OFF and owner-enabled behind an EU-AI-Act acknowledgement + geofence. This is the first feature to engage the Annex III high-risk obligation set — the framework it needed is the six guardrails + opt-in gate, not a deferred separate build. See [`ai-features.md`](../9-compliance/ai-features.md), [`ai-fit-analysis.md`](../redesign/ai-fit-analysis.md), and the flow [`S11`](../redesign/flows/S11-ai-fit-analysis.md).

A broader applicant-**list** fit indicator remains intentionally _not_ built (it invites ranking/auto-decisioning) — see S11 §5 "Deliberately NOT built".

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
| C-012 / A-007 | `exactOptionalPropertyTypes` (remaining strict flag) | ✅ Shipped 2026-07-20 — flag enabled in `tsconfig.json`; 40 cosmetic errors fixed (optional props/params widened to `\| undefined`; Radix wrapper spreads made conditional). |
| A-002 / A-005 | Component splits (`candidates/page.tsx`, `vacancy-form.tsx`, `candidate-form.tsx`) | ✅ Shipped 2026-07-20 — candidates list split into `lib/candidates/list-derivation.ts` + row/cell components; vacancy + candidate forms migrated to react-hook-form and split into section components. |

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

- ✅ Slack / Teams notifications — shipped 2026-06-24 as G-030. Per-org webhooks, 8 event types.
- ✅ Calendly — shipped 2026-06-24 as G-031. OAuth + UTM-tracked links + webhook-driven interview creation. Cal.com deferred.
- ⚪ **Email tracking** — open/click tracking on recruiter-sent emails (Resend supports it; needs a toggle in `/settings/email-templates`).
- ⚪ **LinkedIn job auto-cross-post** — current LinkedIn integration is page-post only; v2 would be cross-posting to Jobs.

### Identity

- ✅ 2FA / TOTP — shipped 2026-06-25 as G-032. Per-user enrollment, owner-controlled org-wide policy, admin reset.
- ⚪ **SSO (SAML)** for enterprise customers. Deferred until a paying enterprise asks; will use WorkOS (~$125/mo) rather than building SAML from scratch.

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

1. ✅ **Slack + Teams notifications** — shipped 2026-06-24 as G-030. Org-managed incoming webhooks at `/settings/integrations/webhooks`, 8 event types, per-webhook on/off, test message button.
2. ✅ **Calendly** — shipped 2026-06-24 as G-031. Admin connects via OAuth; recruiter generates UTM-tagged Calendly links per candidate; bookings flow back as interview rows. Cal.com deferred per founder direction (free for customers).
3. ⚪ **LinkedIn jobs auto-cross-post** — extends the existing LinkedIn page-post integration.
4. ⚪ **Reference checks workflow** — request, collect, store references against a candidate.

### Phase 6 — Identity & SSO

1. ✅ **2FA / TOTP** — shipped 2026-06-25 as G-032. Supabase Auth MFA primitives, per-user opt-in, owner-controlled org-wide policy (`require_mfa` or `require_mfa_for_admins`), middleware AAL gate, admin reset path for lost-phone recovery.
2. ⏭️ **SSO (SAML)** — deferred until an enterprise customer asks. Will integrate WorkOS (~$125/mo) — JIT user provisioning + SCIM + IDP-initiated and SP-initiated flows. Estimated 1 week from contract.

### Phase 7 — Multi-language UI (i18n)

Decoupled from the rest. Triggered by a market-launch decision. Strategy already sketched at the top of "Big features". **Full execution plan (EN/KA/RU, personal UI vs org content, per-vacancy content, AI language rule, landing switcher):** [`docs/redesign/i18n-plan.md`](../redesign/i18n-plan.md) — authored 2026-07-31, awaiting go/scope decision.

Sub-sequence when it lands:
1. `next-intl` setup + locale routing.
2. Public surfaces first — `/apply/[token]` and `/status/[token]`.
3. Recruiter dashboard surfaces.
4. Email templates.

### Phase 8 — AI screening

Blocked on the EU AI Act risk-management framework for higher-risk features. Don't start until that framework exists.

### Phase 9 — Tech debt (one focused PR pass)

1. ✅ **WCAG accessibility audit** (AC-012) — shipped 2026-06-26. Bumped light-mode `--muted-foreground` to pass WCAG AA contrast; added missing aria-labels to icon-only buttons across candidate / vacancy / interview / document surfaces.
2. ✅ **Strict tsconfig — `noUncheckedIndexedAccess`** (C-012) — shipped 2026-06-26. 108 errors fixed across actions, AI modules, components, tests. ✅ **`exactOptionalPropertyTypes`** shipped 2026-07-20 — flag enabled; 40 cosmetic errors fixed (optional props/params widened to `| undefined`, Radix wrapper spreads made conditional).
3. ✅ **Component splits + `react-hook-form` migration** (A-002, A-005) — shipped 2026-07-20. `candidates/page.tsx` split into pure `lib/candidates/list-derivation.ts` + `candidate-table-row` / `candidate-optional-cell`; `vacancy-form.tsx` + `candidate-form.tsx` migrated to react-hook-form (`VacancyFormSchema` / `CandidateFormSchema`) and split into `components/{vacancies,candidates}/form/` section components. Edit-only surface (create uses the wizards); the RHF-owned core is validated by the form-facing schemas while orchestration state (CV-parse, pending exp/edu, files) stays in `useState`.
4. ⏭️ **Keyset / cursor pagination** (F-009 follow-up) — parked indefinitely. No customer is near the ~5K row trigger; revisit reactively when a slow list query shows up in PostHog or Sentry, not pre-emptively.

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
| 2026-06-26 | Phase 9 partial shipped: 9.1 WCAG accessibility (AC-012; light-mode `--muted-foreground` darkened for AA contrast, aria-labels added on icon-only buttons across candidate / vacancy / interview / document surfaces) and 9.2 `noUncheckedIndexedAccess` (C-012; 108 errors fixed across actions, AI generators, components, tests — batch-fixed the `parsed.error.errors[0].message` + `MODELS[i]` idioms). 9.3 RHF migration (vacancy-form 656 LOC, candidates/page.tsx 541 LOC) deferred to dedicated session; 9.4 keyset pagination parked until a real slow-query signal. `exactOptionalPropertyTypes` deferred (~25 cosmetic Radix/prop-pass-through). | Aleksandre Merabishvili |
| 2026-06-25 | Phase 6.1 shipped: 2FA / TOTP (G-032). Per-user enrollment via the Two-factor card on `/settings/profile`; owner-controlled org-wide policy via `/settings/organization`; middleware AAL + enrollment gate; admin reset path on `/settings/team`. Migration 042 adds `organizations.require_mfa`, `organizations.require_mfa_for_admins`, `profiles.mfa_enrolled` (cached). 22 unit tests on the two pure helpers. Phase 6.2 SAML SSO deferred until enterprise customer; will use WorkOS. | Aleksandre Merabishvili |
| 2026-06-24 | Phase 5 partial shipped: Slack + Teams notifications (G-030) and Calendly (G-031). Two new tables (`webhook_notifications`, plus Calendly fields on `organization_integrations`). 34 unit tests on the pure helpers (payload builders, link builder, webhook HMAC verify, event allow-list). Manual deployment steps for the founder collected in `docs/4-integrations/phase-5-manual-steps.md`. Remaining Phase 5 items: LinkedIn jobs auto-cross-post + reference checks workflow. | Aleksandre Merabishvili |
| 2026-06-23 | Phase 4 shipped: Reports (G-029). New `/reports` route with three sub-tabs — pipeline conversion funnel, time-to-hire stats + per-vacancy breakdown, source effectiveness. Period selector (7/30/90/365 days + all-time). Migration 039 backfills `applications.source_type = 'manual'` on existing NULLs + sets DEFAULT 'manual' for future inserts. Recharts added (~80KB) for the funnel bar chart. 40 unit tests on the four pure helpers (period, funnel, time-to-hire, source-summary). Recruiter productivity deliberately skipped. Next: Phase 5 (Integrations). | Aleksandre Merabishvili |
| 2026-07-20 | Phase 9 completed: `exactOptionalPropertyTypes` enabled (C-012/A-007; 40 cosmetic errors fixed) + component splits / react-hook-form migration (A-002/A-005): `candidates/page.tsx` → `lib/candidates/list-derivation.ts` + row/cell components; `vacancy-form.tsx` + `candidate-form.tsx` → RHF (`VacancyFormSchema` / `CandidateFormSchema`) split into `components/{vacancies,candidates}/form/`. 29 new tests. | Aleksandre Merabishvili |
