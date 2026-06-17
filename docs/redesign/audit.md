# HRHandle Redesign — Critical Audit

> **Authored:** 2026-06-15. **Decisions locked:** 2026-06-16. **Scope:** the `Redisign New.zip` package (14 visual screens, 4 markdown docs, 100+ screenshots) against the current HRHandle staging codebase. **Posture:** adversarial. The goal of this document is to expose problems, not to validate the redesign.
>
> **Companion docs:**
> - [`roadmap.md`](roadmap.md) — revised roadmap (KEEP / REVISE / DROP / ADD verdicts on each item from the redesign's `ROADMAP.md`).
> - [`ai-fit-analysis.md`](ai-fit-analysis.md) — AI Fit Analysis spec + six guardrails + competitive market analysis (was open question §8.5, now its own document).
> - [`mobile/`](mobile/) — design output for the four must-work-on-phone flows.
> - [`flows/`](flows/) — per-screen flow analyses (S01 written, S04+ pending).
> - Source materials remain in [`/redesign/`](../../redesign/) (gitignored).

---

## 0. Status — decisions locked

All 14 open questions from §8 have been resolved as of 2026-06-16. Quick reference:

| # | Question | Locked decision |
|---|---|---|
| Q2 | Vacancy-scoped board location | Keep both URLs (`/pipeline` global + `/vacancies/[id]/pipeline` scoped, same component) |
| Q3 | Custom stages model | **Per-vacancy** custom stages, **max 10 stages per vacancy**, stage **type restricted** to a fixed enum (`standard / interview / offer / review`). No org-templates path. |
| Q5 | "Today" dashboard | **Dropped.** Reports covers the overview need. Nav line in SCREEN-SPECS gets corrected. |
| Q6 | AI Fit Analysis | **Not blocked** — ship with [six guardrails](ai-fit-analysis.md#3-the-six-guardrails) + legal consult before launch. See [`ai-fit-analysis.md`](ai-fit-analysis.md). |
| Q6 (G-026 conflict) | Saved views | **Keep.** Extend `saved_views` with `'pipeline'` list_kind. No migration needed (greenfield). |
| Q7 | Settings → Notifications page | Confirmed as a NEW page; contents spec still needed (small follow-up). |
| Q8 | Settings → Security MFA split | **Split as designed** — per-user MFA stays at Personal → Security, org policy stays at Organization. |
| Q9 | Vacancy detail applications list | **No Candidates tab.** Applications list lives at `/vacancies/[id]/pipeline` (the deep-link route). Vacancy Overview shows a top-5 "Candidates peek" with "View all in pipeline →" link. |
| Q10 | Candidate Merge | **Keep with defined spec** — see [§4.2 Reuse opportunities](#42-·-s2-·-candidate-profile-candidate-profile-a-refineddchtml) update. Triggered from header `⋯` or duplicate-detection banner; 3-step confirm (pick → resolve conflicts → confirm); applications/notes/activity/documents/interviews/scorecards combine; identity fields chosen per-conflict (default most recent); same-vacancy collision keeps furthest-along application; audit log entry + redirects. |
| Q11 | Repeat-applicant banner | **3+ rejections threshold.** |
| Q12 | Screening manual gate | **Folded into stage move.** No separate Yes/No control. Screening section on profile is read-only passive context; decision = Advance or Reject in the right rail. Confirmed by the user-updated `Candidate Profile A Refined.dc.html`. |
| Q13 | Wizard vs single-scroll creation | **Stepped wizard** (per redesign S4d). |
| Q14 | Scorecard migration | **No migration.** Greenfield rebuild. The user is cleaning all existing customer data before launch — the site is not yet published. |
| Q14 (mobile) | Mobile pipeline pattern | **Combine A + B** — single-column stage-switcher when the global board is on phone, AND Review mode is the canonical mobile pipeline pattern. |
| Q-S01-b | Review mode scope | **Both** global (`/pipeline/review`) and per-vacancy. |
| Q-S01-c | Stale threshold | **Hardcode 5 days.** |
| Q-S01-d | Bulk Schedule with N>1 | **Hide the button** when more than one candidate is selected. |
| Q-S01-e | 0-vacancies empty state | **Welcome card** with "Create your first vacancy" CTA + 3-step orientation (per user-uploaded `Pipeline Empty State.dc.html`). No redirect. |

**Single biggest implication:** **no data migration anywhere.** This collapses several "🔴 must fix" items in §3 (regression register) and removes Phase 0.6 (scorecard migration plan) from the roadmap entirely. Custom stages, scorecards, saved views, and offers are all greenfield builds.

The historical analysis below (sections 2–8) is preserved as-is for context. Where a decision has resolved a flagged issue, that's annotated inline.

---

## 1. Methodology

**What I compared.** For each redesign screen I read three things together: the `.dc.html` file (visual source of truth), the matching section of `SCREEN-SPECS.md` (behavioral source of truth), and the current implementation in code (server actions, components, DB schema, migrations). Where a feature is post-redesign (anything from G-022 onward — see `docs/1-product/roadmap.md`), I also checked whether the redesign accounts for it.

**What I deliberately did not cover.**
- **Visual taste** — color choices, exact spacing, typography. The design system is locked (blue 250, teal 165, DM Sans, 10px radii, 4px grid). I treat it as a constraint, not a debate.
- **Component-level code quality.** This is a UX / IA audit, not a refactor proposal.
- **Performance benchmarks** — I flag perf traps in feasibility, but don't measure them.
- **Per-pixel mobile mocks** — see [`mobile/`](mobile/) for design output; pixel work happens in implementation.
- **Internationalization** — i18n is its own Phase 7 in your product roadmap; the redesign barely touches it and I won't add to that scope here.

**Severity scale used throughout.**
- 🔴 **Must fix** — the redesign cannot ship as-drawn without addressing this.
- 🟡 **Flag** — meaningful, but a competent implementer can route around it. Worth recording before it's forgotten.
- 🟢 **Acceptable** — known cost, intentional trade-off, or low-risk omission.

**Note on the "audit-of-the-audit".** Several "problems" the redesign claims to solve are already partially solved in code (Migration 022 candidate-status sync, vacancy_questions table, offers table). These are flagged as "premise wrong" rather than "redesign bad" — but they materially change the implementation work and roadmap sequencing.

---

## 2. Cross-cutting problems

These are issues that affect the redesign as a whole, not any one screen. Where the redesign documents (ROADMAP / SCREEN-SPECS / REDESIGN-DECISIONS) contradict each other, the contradiction itself is the problem.

### 2.1 🔴 "Today" dashboard is in three states at once

- **REDESIGN-DECISIONS §1 (locked):** "Rebuild Dashboard as **Today** — an action queue (new applicants to review, interviews today, offers awaiting reply, candidates stale > N days), not passive stat tiles."
- **ROADMAP §0 (thesis):** "**Dashboard dropped** — Reports covers the overview need."
- **SCREEN-SPECS nav line:** "`Today · Pipeline · Vacancies · Candidates · Interviews · Reports · Settings`."

Three documents, three answers. There is **no S0 / S-spec for Today**. There is no `.dc.html` file for it. If it's being kept, it needs a spec, a screen file, and a roadmap item. If it's being dropped, the nav line in SCREEN-SPECS is wrong.

**My recommendation:** keep "Today" but as a follow-up, not a launch item. It's a new screen with no design and no current implementation — adding it to Wave 1 expands scope. Drop from current nav, defer to a "Wave 4 / Polish" item. Drop the Today line from SCREEN-SPECS nav and leave "Dashboard dropped" as the canonical statement until designed.

### 2.2 🔴 Screen file count mismatch (14 vs 11 vs 20)

ROADMAP says 11 screens; the package has 14 `.dc.html` files in SCREEN-SPECS' canonical list; the actual extracted folder has **20** `.dc.html` files. Some are exploratory drafts that should be marked as such:

| File | Status |
|---|---|
| `Pipeline Directions.dc.html` | exploratory (3 directions) — superseded by `Pipeline Versions.dc.html` |
| `Pipeline Versions.dc.html` | canonical |
| `Candidate Profile Directions.dc.html` | exploratory |
| `Candidate Profile Versions.dc.html` | exploratory (3 versions) |
| `Candidate Profile Detailed.dc.html` | working draft |
| `Candidate Profile A Refined.dc.html` | canonical |
| `Create Flows.dc.html` | exploratory (aspirational) — superseded by S4d's two files |
| `Create Vacancy Steps.dc.html` | canonical |
| `Create Candidate Steps.dc.html` | canonical |

**My recommendation:** rename exploratory files with a `_DRAFT_` prefix or move to `redesign/_drafts/`. The README should list the 11 canonical files explicitly. An implementer who opens `Candidate Profile Detailed.dc.html` thinking it's canonical will build the wrong thing.

### 2.3 🔴 Open decisions resolved in one doc, still open in another

| Decision | Status |
|---|---|
| Creation flow (wizard vs single-scroll) | REDESIGN-DECISIONS §S4d says "✅ RESOLVED — stepped wizard, publishable after Basics". ROADMAP §5 lists it as still open ("real product is single-scroll"). SCREEN-SPECS S4d says "OPEN whether to ship as wizard vs keep current single-scroll page (user leaning: confirm)." |
| Screening manual gate (Yes/No) | REDESIGN-DECISIONS §3 says "Leaning redundant → fold into stage move." SCREEN-SPECS S2 says "🅿 may be folded into stage move." ROADMAP §5 lists as open. Effectively all three say "lean fold-in" but none commits. |
| Vacancy Overview version (A vs B) | SCREEN-SPECS S4 says "**chosen: Version B + A's time-to-fill benchmark**". ROADMAP §5 says "Version B + time-to-fill benchmark (recommended)" but lists as still to confirm. |
| Repeat-applicant banner (always vs threshold) | "Leaning threshold" in all three docs. Same status everywhere. |

**My recommendation:** REDESIGN-DECISIONS is supposed to be the locked log per its own preamble ("Each audit section appends locked decisions here"). Either lock the four leans explicitly or reopen them as Wave 1 pre-work. Right now an implementer has to guess which doc is authoritative.

### 2.4 🟡 Premise of "kill dual-status" is half-wrong

The single biggest "global model" the redesign introduces — `Derived status — Remove editable General Status` — assumes the field has independent state. It doesn't, fully:

- **Migration 022** ([`scripts/022_candidate_status_sync_trigger.sql`](../../scripts/022_candidate_status_sync_trigger.sql)) already syncs `candidates.general_status_id` automatically when all of a candidate's applications close. So "derived" is already implemented at the DB level.
- **However** Migration 022 looks for `candidate_statuses.code = 'inactive'`, but Migration 009 simplified codes to `'active' | 'hired' | 'archived'` only. **The trigger is silently a no-op for the common "all-apps-rejected" case.** It does fire correctly when an offer is accepted (the `hired` code does exist), but not on close-out.
- The editable UI control at [`app/(dashboard)/candidates/[id]/page.tsx:408`](../../app/(dashboard)/candidates/[id]/page.tsx#L408) (`CandidateStatusSelect`) is what's actually behaving like a separate field. Killing the control + fixing the trigger code reaches the redesign's stated goal in two lines.

🔴 **This is a real bug worth a P1 fix even if the redesign never ships.** Filing as part of Phase 0 (see roadmap).

🟡 **For the redesign:** the framing should be "fix the trigger + remove the editable dropdown," not "rebuild the data model." Wave 1.1's effort is overcosted; the actual work is one migration + one component removal, not a model change.

### 2.5 🔴 Features shipped post-design package are not reconciled

The redesign was authored against an earlier HRHandle. Since then your product roadmap has shipped:

| ID | Feature | Redesign coverage |
|---|---|---|
| G-021 | @-mentions in candidate notes | Mentioned in S2 ("composer w/ @mention + thread") — incidental, no detail |
| G-022 | Candidate self-withdraw on status page | Not mentioned. The `/status/[token]` design (S5) shows simplified labels but no withdraw control |
| G-023 | Global cmd-K search | Not mentioned anywhere. S1 nav shows "⌘K" in topbar but no detail; it's not on any nav diagram for non-Pipeline screens |
| G-024 | Bulk move-to-stage | Mentioned in S1 ("bulk action bar") but only on Pipeline. The current implementation has it on Vacancy → Candidates tab as well; the redesign drops this surface |
| G-025 | Scorecard sharing via `/scorecard/<token>` | **Not mentioned at all.** The redesign treats scorecards as net-new. The public `/scorecard/<token>` page doesn't appear in the screen inventory |
| G-026 | Saved filter views per recruiter | Not mentioned. S3 (Vacancies list) explicitly says "**Views removed** — redundant with filter tabs at 5–30-vacancy scale" — but this is a working shipped feature being marked for removal without a migration plan |
| G-028 | CSV import wizard at `/candidates/import` | Not mentioned. New nav has no place for the import wizard |
| G-029 | Reports page | Mentioned in S8 with fixes — but Reports already shipped using Recharts with working funnel + period selector. The "fix black funnel bars" complaint may be stale |
| G-030 | Slack/Teams webhooks at `/settings/integrations/webhooks` | Mentioned implicitly in S7 ("+ Slack/Teams webhooks") but as a sub-page detail. The 8-event configuration UI is real and complex; redesign collapses it to one line |
| G-031 | Calendly integration at `/settings/integrations/calendly` | Mentioned in S7 but again as a sub-page detail. OAuth flow, UTM-tagged link generation, webhook receiver are non-trivial existing surfaces |
| G-032 | 2FA with org-wide policy | S7 lists "Security (NEW — houses MFA/password)" under Personal. But MFA already lives on `/settings/profile` (per-user) AND `/settings/organization` (org policy). The redesign moves both to a new sub-page without addressing the org-level policy card |

**Severity:** 🔴 for G-025 (scorecard sharing), G-026 (saved filter views), G-028 (CSV import), and G-032 (2FA org policy) — these are real features the redesign would either silently drop or fail to integrate.

🟡 for the rest — they're flagged in the redesign but not designed.

### 2.6 🔴 Pipeline stage `type` model is a real schema migration, not a UI tweak

The redesign proposes pipeline stages have a `type` of `Standard | Interview | Offer | Review` to drive contextual actions on the profile (S4b Custom Stages). Today:

- [`scripts/001_create_schema.sql:application_statuses`](../../scripts/001_create_schema.sql) — 5 fields: id, name, code, is_active, sort_order. **No `type` column.** No relation to vacancy.
- Stages are **global per environment**, not per-vacancy. There are 7 fixed codes (applied/screening/interview/offer/hired/rejected/withdrawn) seeded at install.
- Adding custom stages per vacancy requires: (a) a new junction table `vacancy_pipeline_stages` (or denormalize onto `application_statuses` keyed by org+vacancy), (b) `type` column, (c) a migration of existing apps' `status_id` references to whatever new model wins, (d) all consumers of `applications.status_id` updated (audit found 20+ files).

ROADMAP rates this `M` effort. **That's wrong.** A bare-minimum-correct version of typed custom stages is the largest single piece of work in the entire redesign — bigger than Wave 2.1 (Global Pipeline) and Wave 2.3 (Candidate profile rebuild) combined.

🔴 **Recommendation:** treat Wave 2.6 as `XL` and either: (a) build it on top of the existing seven stages with a per-vacancy override layer rather than a free-form custom-stages-per-org, or (b) defer it to Wave 4 and ship the rest of the redesign on the existing global-stages model. Option (b) is much safer.

### 2.7 🟡 Existing scorecard data model is invisible to the redesign

The Assessment-model section is presented as a new design. But:

- [`scripts/008_column_preferences_and_evaluations.sql`](../../scripts/008_column_preferences_and_evaluations.sql) — `vacancy_questions` (`type IN ('text', 'score')`), `candidate_evaluations` (`score 0..100`, unique per application), `candidate_evaluation_answers` (`score_value 1..10`).
- [`scripts/037_candidate_evaluations_scorecard_token.sql`](../../scripts/037_candidate_evaluations_scorecard_token.sql) — `scorecard_token`, `scorecard_revoked_at`, `shared_by`, `shared_at` for the share-via-link feature.
- [`app/scorecard/[token]/page.tsx`](../../app/scorecard/[token]/page.tsx) — token-gated public scorecard viewer (G-025).

The redesign's scorecard model differs from this in three ways:
1. Scale: redesign wants **1–5** for attribute ratings; current is **1–10**.
2. Tagging: redesign wants **must-have ★**; current `vacancy_questions` has no must-have flag.
3. Recommendation: redesign wants **forced overall recommendation** (Strong yes / Yes / Lean no / No); current `candidate_evaluations.score` is a 0–100 number derived somehow from answers — there's no recommendation field.

The redesign does **not** discuss migration from the existing model. So either it tacitly assumes a greenfield (losing all evaluation data and breaking the public `/scorecard/<token>` URLs) or it's a schema migration with backward compat for existing tokens.

🔴 **Severity bumped because the data model exists.** A net-new design without a migration plan is the most common "ship-and-immediately-regret" failure mode for redesigns.

### 2.8 🟡 AI features the redesign repositions but doesn't drop

S10 (AI & Terminology) lists 5 AI features the new "calm pattern" applies to: CV parse, JD generation, bias check, candidate summary, scorecard-from-notes. Currently shipped:

| AI feature | Current location | Redesign reposition |
|---|---|---|
| CV parse | `/api/parse-cv`, used by ApplyForm + Add candidate | Same uses, calmer label |
| JD generation | `AiJdSuggest` in vacancy edit page | Moved into Create Vacancy step 3 |
| Bias check | `AiBiasCheck` in vacancy edit page | Same location, calm framing |
| Assessment suggester | `AiAssessmentSuggester` in vacancy detail QE tab | Moved into Vacancy → Scorecard tab |
| Interview questions | `AiInterviewQuestions` in vacancy detail | Not mentioned (orphaned) |
| Candidate summary | `AiSummaryPanel` in candidate profile | Same location, calm framing |
| AI notes extractor | `AiNotesExtractor` in candidate profile | Renamed to "Structure interview notes" |
| Email drafter (G-015) | **Retired 2026-06-21** | Not mentioned (would be confusing if not noted) |

🟡 **Interview questions AI is orphaned** — it's a 4th vacancy-detail tab today; the redesign's new 5-tab structure (Overview / JD / Scorecard&questions / Apply form / Settings) has no obvious home for it. Either fold into Scorecard&questions or drop, but the redesign should say.

🟢 Email drafter retirement is a no-op for the redesign (no design exists), but the README should note "AI features retired since this package was written: G-015 email drafter."

### 2.9 🟡 Mobile guidance is one paragraph

ROADMAP §3 ("Mobile guidance") is one paragraph. SCREEN-SPECS does not have a per-screen mobile section. The audit-companion `mobile/` folder ([`mobile/`](mobile/)) fills part of this gap, but the redesign as authored is desktop-first.

For a product where:
- The **apply form is mostly used on phones** (per current FAQ language in the product roadmap)
- The **offer page is a `/offer/[token]` link** sent by email and opened on whatever device the candidate has
- The **status page** is candidate-facing
- **Recruiters check today's interviews from phones** between back-to-back meetings

…this is undercooked. See §6 for detail.

### 2.10 🟡 "All roles" global pipeline at scale is a performance trap

Wave 2.1 promotes Pipeline to a top-level destination with an "All roles" default view. For a recruiter with 50 vacancies and 1000 active applications across them, "All roles" means rendering 1000 candidate cards in a draggable kanban with role filter chips, multi-select, and a sticky bulk action bar.

The current per-vacancy pipeline ([`app/(dashboard)/vacancies/[id]/pipeline/page.tsx`](../../app/(dashboard)/vacancies/[id]/pipeline/page.tsx)) loads all applications for one vacancy without pagination — fine at ~50 candidates per vacancy. Global pipeline at 10× the cardinality with the same component will hit JS-heap and drag-handler perf limits.

🟡 **Recommendation:** the spec should mandate either (a) virtualized scrolling for board columns (`react-virtual` or similar), (b) hard pagination per stage column ("show 50, load more"), or (c) "All roles" disabled above 200 active apps with a soft-fallback to per-role chip filtering. Without one of these the All-roles view will be unusable for the customers who would benefit from it most.

### 2.11 🟡 Terminology contradictions in S10 vs current code

S10 says "RETIRE 'Incomplete' → say what's missing" — but `incomplete` is not in `application_statuses` or `candidate_statuses`. Grepped: I don't see this status anywhere. The complaint may refer to an old UI label that no longer exists; if so, it should be removed from S10 to avoid an implementer hunting for it.

🟢 Worth one sentence in the roadmap: "S10 terminology review — confirm 'Incomplete' is not in current taxonomy before scoping; remove from spec if absent."

---

## 3. Regression risk register

These are current features whose treatment in the redesign is missing, ambiguous, or actively dropped. One row per feature with a code citation so you can verify.

| ID | Feature | Current location | Redesign treatment | Severity |
|---|---|---|---|---|
| RR-01 | Candidate `general_status_id` field + auto-sync trigger | [`scripts/022_candidate_status_sync_trigger.sql`](../../scripts/022_candidate_status_sync_trigger.sql), [`components/candidates/candidate-status-select.tsx`](../../components/candidates/candidate-status-select.tsx) | "Killed" — but no migration plan; trigger is silently broken (looks for `'inactive'` code that doesn't exist post-mig-009) | 🔴 |
| RR-02 | Per-vacancy pipeline drag-drop kanban | [`app/(dashboard)/vacancies/[id]/pipeline/page.tsx`](../../app/(dashboard)/vacancies/[id]/pipeline/page.tsx), [`components/pipeline/kanban-board.tsx`](../../components/pipeline/kanban-board.tsx) | Kept ("Vacancy detail keeps a scoped board (same component)") but Wave 2.4 vacancy-detail rebuild has no pipeline tab in the proposed 5-tab structure | 🔴 |
| RR-03 | Vacancy detail "Interview questions" tab | [`app/(dashboard)/vacancies/[id]/page.tsx:467`](../../app/(dashboard)/vacancies/[id]/page.tsx#L467), `AiInterviewQuestions` component | Orphaned — no home in proposed 5-tab structure | 🟡 |
| RR-04 | Vacancy detail "Apply Link" tab | [`app/(dashboard)/vacancies/[id]/page.tsx:467`](../../app/(dashboard)/vacancies/[id]/page.tsx#L467), `ApplicationFormTab` | Renamed "Apply form" (form builder) — but current is just a public-link copier, no field builder. Redesign upgrades this from share-link to drag-reorder form builder, but no spec for migrating existing tokens | 🟡 |
| RR-05 | Vacancy `interview_questions` JSONB (per-vacancy AI-generated set) | `vacancies.interview_questions` column (Migration 032) | Not mentioned. The JSON shape (`behavioural / technical / situational / closing`) is unique — if the redesign drops the tab, what happens to existing data? | 🟡 |
| RR-06 | Candidate "Add to vacancy" dialog | [`components/candidates/add-application-dialog.tsx`](../../components/candidates/add-application-dialog.tsx) | Mentioned in S2 header ("Add to vacancy") but no spec for the dialog itself (vacancy picker, starting stage, source) | 🟡 |
| RR-07 | Vacancy duplicate, archive, restore | [`components/vacancies/duplicate-vacancy-button.tsx`](../../components/vacancies/duplicate-vacancy-button.tsx) + Migration 030 `restored_at` columns | "Duplicate vacancy" appears in S3 row menu; archive/restore appears in Trash. But Trash UI is mentioned once, no spec | 🟡 |
| RR-08 | Candidate documents (upload, list, delete) | [`components/candidates/candidate-documents.tsx`](../../components/candidates/candidate-documents.tsx), `candidate-documents` Supabase storage bucket | Mentioned in S2 rail ("DOCUMENTS (+Upload)") but no spec for non-CV documents, MIME-type restrictions, multi-file upload | 🟡 |
| RR-09 | LinkedIn cross-post button on vacancy detail | [`components/vacancies/linkedin-post-job-button.tsx`](../../components/vacancies/linkedin-post-job-button.tsx), `getLinkedInIntegration` | Not mentioned anywhere in the redesign. Feature exists, has a working integration, and disappears from the vacancy-detail rebuild | 🔴 |
| RR-10 | Public scorecard share (`/scorecard/<token>`) | [`app/scorecard/[token]/page.tsx`](../../app/scorecard/[token]/page.tsx), Migration 037 | Not in screen inventory. Scorecard model rebuild in S2 doesn't address how existing share tokens migrate | 🔴 |
| RR-11 | Public status page withdraw button | [`app/status/[token]/page.tsx:192`](../../app/status/[token]/page.tsx#L192) (G-022) | Not mentioned. S5 status page spec doesn't show the withdraw control | 🟡 |
| RR-12 | Settings → Integrations → Webhooks sub-page (Slack/Teams) | [`app/(dashboard)/settings/integrations/webhooks/page.tsx`](../../app/(dashboard)/settings/integrations/webhooks/page.tsx) (G-030) | S7 says "Slack/Teams webhooks" parenthetically. The 8-event config UI, per-webhook toggles, test message button are not in scope | 🟡 |
| RR-13 | Settings → Integrations → Calendly sub-page | [`app/(dashboard)/settings/integrations/calendly/page.tsx`](../../app/(dashboard)/settings/integrations/calendly/page.tsx) (G-031) | S7 says "Calendly sub-pages" parenthetically. OAuth connect, event-type picker, UTM-link generation are not in scope | 🟡 |
| RR-14 | Settings → Organization → MFA policy card | [`app/(dashboard)/settings/organization/page.tsx`](../../app/(dashboard)/settings/organization/page.tsx) (G-032) | S7 moves MFA to a new "Security" sub-page under Personal. But the org-level `require_mfa` / `require_mfa_for_admins` policy lives at the org level; moving it splits ownership across two pages | 🟡 |
| RR-15 | CSV candidate import wizard `/candidates/import` | [`app/(dashboard)/candidates/import/page.tsx`](../../app/(dashboard)/candidates/import/page.tsx) (G-028) | Not in screen inventory. No place in new IA. Significant existing surface (template download, column mapping, preview, error CSV) | 🔴 |
| RR-16 | Saved filter views per-recruiter | Migration 038, saved_views table (G-026) | S3 says "Views removed". S2 (candidate list) doesn't address. Working shipped feature; redesign removes without migration | 🔴 |
| RR-17 | Cmd-K global search | (G-023) | S1 nav shows "⌘K" pill in topbar; not on other screens; no spec for the modal | 🟡 |
| RR-18 | Audit log viewer | [`app/(dashboard)/settings/audit-log/page.tsx`](../../app/(dashboard)/settings/audit-log/page.tsx) (G-019) | S7 lists "Audit log (who/what/when)" — adequate one-liner, but filter complexity (entity type, user, date range, action) not in spec | 🟡 |
| RR-19 | Trash viewer | [`app/(dashboard)/settings/trash/page.tsx`](../../app/(dashboard)/settings/trash/page.tsx) (G-020) | S7 lists "Trash (30-day recovery countdown)" — adequate one-liner | 🟢 |
| RR-20 | Vacancy "Sector" field | [`vacancies.sector_id`](../../scripts/001_create_schema.sql), Sectors lookup table | S4d Create Vacancy step says "Sector→optional" (kept). Detail page rail shows sector. But no equivalent on candidate side — sectors only appear on vacancies | 🟢 |
| RR-21 | Subscription page `/subscription` separate from `/settings/billing` | [`app/(dashboard)/subscription/page.tsx`](../../app/(dashboard)/subscription/page.tsx) — billing is a redirect | Redesign collapses to one — correct. No migration risk (billing already redirects to subscription). Just delete the redirect | 🟢 |
| RR-22 | Trial banner | global header | S1 + REDESIGN-DECISIONS §1 say collapse to header pill — correct, low risk | 🟢 |
| RR-23 | Onboarding flow `/onboarding/company` | [`app/onboarding/company/page.tsx`](../../app/onboarding/company/page.tsx) | Not mentioned. OAuth users land here for company-name + full-name capture; the redesign doesn't address whether the page styling changes | 🟡 |
| RR-24 | Email templates (per-org, with `{{variable}}` and categories) | [`app/(dashboard)/settings/email-templates/page.tsx`](../../app/(dashboard)/settings/email-templates/page.tsx) | S7 lists "Email templates ({{variable}}, categorized)" — adequate one-liner. No detail on the editor surface | 🟡 |
| RR-25 | Rejection reasons + rejection templates (linked) | [`app/(dashboard)/settings/rejection-reasons/page.tsx`](../../app/(dashboard)/settings/rejection-reasons/page.tsx), Migrations 015–017 | S7 lists "Rejection reasons (list)" — but doesn't mention the templates-linked-to-reasons model. Templates auto-fill when a reason is picked at reject time | 🟡 |
| RR-26 | Public job listing org logo + slug | [`app/jobs/[slug]/page.tsx`](../../app/jobs/[slug]/page.tsx), `organizations.public_page_slug` | S5 has light branding (logo + thin brand bar). No regression — but spec doesn't say what happens if `public_page_slug` is unset on an existing org | 🟢 |
| RR-27 | GDPR Article 13 notice on apply form | `components/apply/apply-form.tsx`, ai-features.md compliance | S5 mentions "GDPR Art.13 notice" — adequate. Just confirm the new design doesn't visually de-emphasize | 🟢 |
| RR-28 | Cloudflare Turnstile captcha on apply form | `TURNSTILE_SECRET_KEY` env, `lib/turnstile.ts` | S5 mentions "invisible Turnstile captcha" — adequate | 🟢 |
| RR-29 | Custom fields system (per-org, candidate + vacancy, 20 each) | [`components/custom-fields/`](../../components/custom-fields/), Migrations 013, 025 | S2 + S4 both mention custom fields in the right rail. Adequate | 🟢 |
| RR-30 | Activity log per candidate (notes + status changes + system events) | [`components/candidates/activity-feed.tsx`](../../components/candidates/activity-feed.tsx) | S2 says "Notes & activity (composer w/ @mention + thread, filters All/Notes/Stage changes)" — adequate | 🟢 |

**Severity summary:** 6 × 🔴 (RR-01, RR-02, RR-09, RR-10, RR-15, RR-16), 17 × 🟡, 7 × 🟢.

🔴 items must be addressed in the roadmap before any wave starts. 🟡 items are flagged as risks but can be resolved during flow-by-flow. 🟢 items are documented for the implementer.

---

## 4. Per-screen audit

One section per canonical `.dc.html` file. Severity 🔴/🟡/🟢 as above.

### 4.1 · S1 · Pipeline ([`Pipeline Versions.dc.html`](../../redesign/Pipeline%20Versions.dc.html))

**What it is.** A global pipeline (cross-vacancy) with Board / List / Review modes, role filter chips, multi-select with bulk action bar, terminal stages (Rejected/Withdrawn) collapsed to a side rail.

**Current implementation.** [`app/(dashboard)/vacancies/[id]/pipeline/page.tsx`](../../app/(dashboard)/vacancies/[id]/pipeline/page.tsx) — **per-vacancy only**. [`components/pipeline/kanban-board.tsx`](../../components/pipeline/kanban-board.tsx) handles drag-drop, rejection flow. No global view, no role chips, no Review mode, no bulk bar at the pipeline level (though G-024 bulk move-to-stage exists on Vacancy → Candidates tab).

**What works.** Color-coded stages (Version B) plays well with existing `VACANCY_STATUS_COLORS` / status-pill colors. The "Review mode" concept is the highest clicks-saved feature the audit identifies. List view re-using same data is sensible — implementation reuse, not parallel components.

**What's broken or missing.**
- 🔴 **No empty state for "no roles yet"** when an org first signs up. Currently the dashboard shows "create your first vacancy"; on the new global pipeline, you'd hit an empty board with no obvious next step.
- 🔴 **No spec for what "role chip" looks like when 50+ vacancies exist** — does it scroll, paginate, fold into a "More…" picker? Implementer guesses → ships wrong.
- 🟡 **"Stale" amber spine** definition is vague — `> N days` where N is unspecified. Make it a per-org setting or a hardcoded 5 days; pick one.
- 🟡 **Bulk reject in the bar** — needs to interoperate with rejection_reasons + rejection_templates (per-org). The spec doesn't address whether the picker appears inline or as a modal.
- 🟡 **Review mode "K skip" semantic** — does skipping mean "leave in Applied" or "snooze for tomorrow"? If snooze, where is the queue?
- 🟡 **Drag-drop on touchscreens** — current `KanbanBoard` is likely desktop-only DnD. On a tablet (an actual recruiter device), spec doesn't say.
- 🟡 **Real-time multi-user editing** — two recruiters drag the same card. Optimistic UI loss case not addressed.
- 🟡 **Vacancy-scoped board context** — REDESIGN-DECISIONS says "Vacancy detail keeps a scoped board (same component)" but Wave 2.4's vacancy-detail rebuild has 5 tabs (Overview / JD / Scorecard&questions / Apply form / Settings) with **no Pipeline tab**. Pick one.

**What's questionable.**
- Density-as-toggle (Comfortable B / Compact C) — sound idea but adds two design surfaces to maintain. Most products end up with one default and a "compact" checkbox; this proposes parity. Make Comfortable canonical, Compact a 30-line CSS variant, not a separate spec.
- "Review mode" Esc behavior — exits to Pipeline. What if you came from a notification? Should return to source.

**Reuse opportunities.**
- `KanbanBoard` component, status colors, drag-handlers, rejection dialog — all reusable. Don't rebuild.
- `RejectionReasonsPicker`, `RejectionTemplates` data — reuse identically.
- `saved_views` table (G-026) — could power "My triage queue" view in Review mode without new schema.

**Referenced but not provided.**
- A "Review mode" mockup is referenced in spec but the `.dc.html` has it as a small subsection. Worth a dedicated screen file.
- "Side rail for terminal stages" — appears to be the right edge of the board; not pixel-clear in the HTML.

---

### 4.2 · S2 · Candidate profile ([`Candidate Profile A Refined.dc.html`](../../redesign/Candidate%20Profile%20A%20Refined.dc.html))

**What it is.** Single-page candidate detail with active-application selector, stage-contextual block (Screening / Interview / Offer), full right rail (Actions / AI summary / Documents / Details / Contact / Custom fields).

**Current implementation.** [`app/(dashboard)/candidates/[id]/page.tsx`](../../app/(dashboard)/candidates/[id]/page.tsx) — 589 lines. Already a single page, two-column grid (1fr / 400px right rail). Current order: AiSummaryPanel, Applied Vacancies (CandidateApplicationsList), Experience, Education, Custom Fields, Activity. Right rail: AiNotesExtractor, Contact, Documents, Interviews, Metadata. Editable `general_status_id` via `CandidateStatusSelect` (the redesign wants to remove this).

**What works.** The current implementation is **already 70% of what the redesign proposes**. The two-column layout with sticky right rail, the on-demand AI panels, the applications list with per-app status — all there. The redesign's main contribution is:
1. The **stage-contextual block** that swaps based on stage type (Screening / Interview / Offer).
2. The **active-application selector** as the single source of truth.
3. The **repeat-applicant banner**.

These are real additions, not rebuilds.

**What's broken or missing.**
- 🔴 **Active-application selector design is locked but not specified for the "0 active, N closed" case.** What does the page show when a candidate has only closed applications? Spec implies the selector is empty; the current page shows them all. Spec gap.
- 🔴 **Stage-contextual block for Standard stages** — what's shown? Spec covers Screening / Interview / Offer / Review but not Standard (Applied / Hired). Empty block? Notes only? Specify.
- 🔴 **Per-application ⋯ "Remove from vacancy"** — is this soft-delete the application, or move to a closed status? Spec ambiguous. Soft-delete preserves activity history; status change preserves audit. Pick one.
- 🟡 **Repeat-applicant banner threshold** — "3+ rejections" lean documented but not locked.
- 🟡 **Application history table** position — collapsible, below active selector. Where exactly? In the left content or right rail? Spec implies left, drawing unclear.
- 🟡 **"Structure interview notes" AI action in rail** — same as current `AiNotesExtractor`. Confirm one-for-one rename, or new behavior.
- 🟡 **Offer creation form in the Offer-stage contextual block** — the current `OfferPanel` is in CandidateApplicationsList, not in a stage block. The redesign collapses two surfaces into one. Migration path unclear.
- 🟡 **Notes composer @mention + thread** — current `ActivityFeed` already has G-021 mentions. Confirm the spec is "existing + nothing", not "new design replacing existing".

**What's questionable.**
- Drop of `CandidateStatusSelect` is correct UI (status should derive) — but the **fix is to remove the dropdown component**, not to remove the data field. The DB field `general_status_id` should stay (it's the cache the trigger writes to). The redesign's framing of "kill the dual-status model" is over-strong; the kill is at UI layer only.
- "Header `⋯` = Archive / Delete / Export / Merge" — Merge is a new feature. The redesign doesn't define what Merge does. Two candidates with overlapping CVs → one candidate? Combine activity logs? This is its own multi-PR.

**Reuse opportunities.**
- Existing `AiSummaryPanel`, `AiNotesExtractor`, `ContactCard`, `CandidateDocuments`, `MetadataFooter`, `ActivityFeed`, `SummaryStrip`, `ExperienceSection`, `EducationSection`, `CustomFieldsDisplay` — all reusable.
- `OfferPanel` in CandidateApplicationsList → repurpose for the Offer-stage contextual block.
- `add-application-dialog` → "Add to vacancy" header action, no rebuild.

**Referenced but not provided.**
- Merge candidates flow — not specified anywhere.
- Per-application ⋯ menu — partially specified, missing "Edit application source" if that's a feature.

---

### 4.3 · S3 · Vacancies list ([`Vacancies.dc.html`](../../redesign/Vacancies.dc.html))

**What it is.** Enhanced table view of vacancies. Search + Sort + Columns configurator + filter tabs + paging footer.

**Current implementation.** [`app/(dashboard)/vacancies/page.tsx`](../../app/(dashboard)/vacancies/page.tsx) — 443 lines. Already has search, sort, column configurator, pagination, saved views (G-026), filter tabs. The list is essentially shipped; the redesign is a visual polish + "drop Views" decision.

**What works.** The redesign's column set (Position with briefcase icon + age, Status, Candidates count, Department, Location, End date, ⋯) is straightforwardly an iteration. Card-grid (List B) as optional toggle is the current behavior.

**What's broken or missing.**
- 🔴 **"Views removed" is a regression for users on G-026.** Saved views per-recruiter is a working shipped feature; removing it without a migration path silently breaks workflows. Either keep, or design a one-click migration.
- 🟡 **"Pipeline-count column dropped"** — current has Candidate count, not Pipeline count, so this is a no-op (rename?). Spec language is unclear.
- 🟡 **Filter tabs counts** — current shows counts; redesign says "+ count". Confirm not duplicate-rendered.
- 🟡 **Row ⋯ menu** — current has View / Edit / Status change. Redesign adds Duplicate, Put on hold, Close, Archive, Delete. Some of these (Hold, Close, Archive, Delete) currently happen via the row status select, not a menu. Decision needed.
- 🟢 **Pipeline-count link** — "intentionally NOT a column (one click deeper)" is fine; current shows Candidates count which links to the same place.

**What's questionable.**
- "Sort: Newest first" as default — current default is `created_desc`. Confirm same.

**Reuse opportunities.** Full current list — no rebuild.

**Referenced but not provided.** N/A.

---

### 4.4 · S4 · Vacancy detail ([`Vacancy Detail.dc.html`](../../redesign/Vacancy%20Detail.dc.html))

**What it is.** Five tabs: Overview / Job description / Scorecard & questions / Apply form / Settings.

**Current implementation.** [`app/(dashboard)/vacancies/[id]/page.tsx`](../../app/(dashboard)/vacancies/[id]/page.tsx) — 706 lines, **biggest page in the dashboard**. Four tabs today: **Candidates / Assessment (qe) / Apply Link / Interview questions**. The vacancy's own edit form (description, dates, salary, etc.) lives on `/vacancies/[id]/edit/page.tsx`, not as a Settings tab.

**What works.** Splitting JD out as its own tab is sensible — currently it's a sidebar card on the Candidates tab. Scorecard & questions as a dedicated tab is right.

**What's broken or missing.**
- 🔴 **No Pipeline tab in the new structure.** Pipeline is currently at `/vacancies/[id]/pipeline` as its own route. The redesign says "vacancy detail keeps a scoped board" but the proposed tabs don't include it. Pick: drop the route (Pipeline only from global), keep the route as deep-link, or add a tab.
- 🔴 **"Candidates" tab is dropped from the new structure entirely.** The current 4-tab layout has Candidates as the primary tab — the actual applications list. The new structure replaces it with Overview, but the Overview drawings show stats / health, not the applications list. Where are the candidates? Spec gap.
- 🔴 **"Settings tab" is new** — currently edit happens at `/vacancies/[id]/edit`. Folding it into a tab is a meaningful UX change. Need to spec: does Settings tab show all of edit's fields inline? Or does it have a "Edit details" button that opens a side sheet?
- 🟡 **"Interview questions" tab orphaned.** Current 4th tab uses `AiInterviewQuestions` for the `interview_questions` JSONB blob. Redesign drops this tab. Migration: data stays, UI moves to Scorecard&questions, or feature retires?
- 🟡 **Apply form tab → field builder upgrade.** Current "Apply Link" tab is a public-link copier. Redesign upgrades to drag-reorder field builder. Implementation cost: significant. Spec doesn't address.
- 🟡 **Overview "Needs your attention" cards** — sound feature, but who computes "stale"? "Interview tomorrow"? `unstable_cache` budget?
- 🟡 **Time-to-fill benchmark** — comparing against what? Industry data? Other org's vacancies? Spec doesn't say.

**What's questionable.**
- Five tabs is the most a single-row tab strip can support without horizontal-scroll on narrower viewports. On a 1280px screen with sidebar (~256px) + header padding, the 5-tab strip will start crowding by the second tab.

**Reuse opportunities.**
- `VacancyApplicationsList`, `VacancyApplicationsToolbar`, `VacancyQuestions`, `AiAssessmentSuggester`, `ApplicationFormTab`, `AiInterviewQuestions`, `VacancyStatusSelect`, `DuplicateVacancyButton`, `DeleteVacancyButton`, `LinkedInPostJobButton`, `AddCandidateToVacancyDialog` — all reusable.
- `getCustomFieldSchema`, `getCustomFieldValues` for the Settings tab.

**Referenced but not provided.**
- "Overview Version A" funnel-first variant — drawn but rejected per SCREEN-SPECS S4. Worth keeping the file for reference.
- Time-to-fill benchmark data source — TBD.

---

### 4.5 · S4b · Custom pipeline stages ([`Custom Stages.dc.html`](../../redesign/Custom%20Stages.dc.html))

**What it is.** Modal-driven stage builder with `Stage name (free text) + Stage type (Standard / Interview / Offer / Review)`. Resulting pipeline supports multi-round interviews ("HR Interview", "Technical Interview", "Final Interview" all inheriting Interview toolkit).

**Current implementation.** None. Stages are global, fixed by Migration 001, no `type` column.

**What works.** The TYPE model is sound and competitor-aligned (Greenhouse, Lever, Ashby all do this). Inheriting toolkit by type, not by name, is the correct abstraction.

**What's broken or missing.**
- 🔴 **No schema design.** Where does `vacancy_pipeline_stages` live? Per-vacancy override of `application_statuses`? Net-new junction table? See §2.6.
- 🔴 **Migration of existing applications.** All currently-applied applications point to one of the 7 global statuses. Moving to per-vacancy custom stages requires: for each vacancy, a default pipeline (matching the global 7), and each app's `status_id` remapped to a row in the new pipeline. Non-trivial.
- 🔴 **Reordering safety.** Reorder a stage mid-flight. What happens to apps already in it? Reorder of a terminal stage (Hired)? Make terminal stages locked / non-reorderable in the UI.
- 🟡 **Delete a stage with apps in it.** Confirm modal? Move-to-where dialog? Block?
- 🟡 **Per-vacancy vs per-org pipelines.** Redesign implies per-vacancy. But for an org with 30 vacancies all using the same flow, re-doing the pipeline 30× is bad UX. Need a "Save as template" path.
- 🟡 **Type-name UX** — "HR Interview (Interview)" reads awkwardly. Show type as a small icon, not parenthetical text.

**What's questionable.**
- Free-text stage name in any language is correct.
- Allowing a stage type of "Review" (scorecard only, no scheduling) overlaps with "Interview" type. What's the practical difference? The spec says Review = scorecard only, Interview = schedule + Join + scorecard. Useful distinction, but rare.

**Reuse opportunities.** The fixed 7-stage seed is the right default template. The new model should ship with it pre-populated.

**Referenced but not provided.** Stage-template save/load (org-level pipelines reusable across vacancies).

---

### 4.6 · S4c / S4d · Creation flows ([`Create Vacancy Steps.dc.html`](../../redesign/Create%20Vacancy%20Steps.dc.html), [`Create Candidate Steps.dc.html`](../../redesign/Create%20Candidate%20Steps.dc.html))

**What it is.** Stepped wizards for vacancy (5 steps) and candidate (4 steps). Publishable after step 1 in vacancy creation.

**Current implementation.** [`app/(dashboard)/vacancies/new/page.tsx`](../../app/(dashboard)/vacancies/new/page.tsx), [`app/(dashboard)/candidates/new/page.tsx`](../../app/(dashboard)/candidates/new/page.tsx) — single-page forms via `components/vacancies/vacancy-form.tsx` (656 LOC) and `components/candidates/candidate-form.tsx`.

**What works.** Real-data alignment is the right call (the redesign's S4d explicitly studied the real forms). The "publishable after Basics" idea solves the quick-vs-rich tension.

**What's broken or missing.**
- 🔴 **Stepped wizard vs single-scroll is unresolved across docs.** REDESIGN-DECISIONS says resolved (wizard); ROADMAP open; SCREEN-SPECS says "user leaning: confirm". Pick.
- 🔴 **Existing `vacancy-form.tsx` is flagged for A-005 RHF migration in product roadmap Phase 9.** The redesign's wizard rebuild touches the same file. Coordinate or risk double-work.
- 🟡 **Duplicate detection on candidate email** — currently exists in `lib/actions/candidates.ts` (duplicate-detection branch returns existing candidate). Confirm one-for-one reuse.
- 🟡 **AI CV parse pre-fill** — currently in candidate form; redesign moves it earlier. Confirm the parse endpoint `/api/parse-cv` is the same.
- 🟡 **"Save & publish now" with defaults** — what's the default scorecard? Empty (5–8 attribute slots, all unfilled)? AI-suggested but not yet confirmed? Spec needs to lock this.

**What's questionable.**
- 5 steps for a vacancy is correct for a first-time user but heavy for the third+ vacancy. The "publishable after Basics" partly addresses this — but the wizard chrome (step rail, Next button) is still in the way. Consider an "Advanced" toggle on the single-scroll form instead — same outcome, less rework.

**Reuse opportunities.**
- `VacancyForm`, `CandidateForm`, `/api/parse-cv`, `AiJdSuggest`, `AiBiasCheck`, `AiAssessmentSuggester` — all reusable.

**Referenced but not provided.** "Prefill from a similar role" — not designed.

---

### 4.7 · S5 · Public pages ([`Public Pages.dc.html`](../../redesign/Public%20Pages.dc.html))

**What it is.** `/jobs/<slug>` (org listing) + `/apply/<token>` (apply form) + status confirmation.

**Current implementation.** [`app/jobs/[slug]/page.tsx`](../../app/jobs/[slug]/page.tsx) (134 lines), [`app/apply/[token]/page.tsx`](../../app/apply/[token]/page.tsx) (188 lines), [`app/status/[token]/page.tsx`](../../app/status/[token]/page.tsx) (209 lines). Apply form has CV parse, GDPR notice, Turnstile (all noted in the redesign). Status page has the G-022 withdraw button.

**What works.** Light branding (logo + thin brand bar) is right. Brand-blue primary CTA matches the design system. Screening questions on the apply form is a real new addition.

**What's broken or missing.**
- 🔴 **Status page withdraw button (G-022) not shown** in S5 spec. Working shipped feature.
- 🔴 **Screening questions on apply form** — described as new, but the data model needed (separate from `vacancy_questions.type='text'`) isn't specified. Are screening questions reusing `vacancy_questions` with a flag, or a new table?
- 🟡 **Knockout vs informational screening Q UX** — spec says "render here, answers feed knockout flags into pipeline" but doesn't show how a knockout question looks visually different from informational.
- 🟡 **"Status page candidate-safe tracker"** — current `statusCodeToBucket()` maps internal codes to candidate-safe buckets (Received / In review / Interview / Decision). Confirm the new design uses the same mapping.
- 🟡 **GDPR notice placement** — current is in the ApplyForm component (not visible from the page file). Redesign mentions but doesn't show.
- 🟢 **"Powered by HRHandle" footer** — kept, current matches.

**What's questionable.**
- "Brand-blue primary button replaces neutral-black" — current is neutral-gray, not black. Confirm.

**Reuse opportunities.**
- `ApplyForm` component (reuse, add screening Qs section).
- Status page bucket mapping (`lib/types/application.ts` → `statusCodeToBucket`).
- Org logo + slug + listing query.

**Referenced but not provided.** "Brand bar" precise spec — single line of brand color above logo? Below header?

---

### 4.8 · S5c · Public offer ([`Public Offer.dc.html`](../../redesign/Public%20Offer.dc.html))

**What it is.** Token-gated `/offer/[token]` with Accept / Decline (confirm-step), countdown, states (sent / accepted / declined / expired / withdrawn).

**Current implementation.** [`app/offer/[token]/page.tsx`](../../app/offer/[token]/page.tsx) (226 lines). Already implements all five states. Token-gated. Plain offer body. Recruiter message optional.

**What works.** All five states already exist in code (Migration 035 + page). The redesign adds two things: a countdown UI for `expiry_date`, and a confirm-before-decline step. Both are small.

**What's broken or missing.**
- 🟡 **Countdown granularity** — to-the-second or to-the-day? Amber threshold at how many hours/days remaining?
- 🟡 **Confirm-decline modal** — what does the optional "decline message" field do? Stored in `offers.decline_reason`? Currently that column exists but isn't wired.
- 🟡 **"Ask a question" 3rd option** — flagged as open. Where does the question go? Email to recruiter? Internal note? Unclear.
- 🟢 **PDF attachment** — open; v2 per existing product roadmap; ignore for this redesign.

**Reuse opportunities.** Full page reuse; add countdown component + confirm modal.

**Referenced but not provided.** N/A.

---

### 4.9 · S6 · Landing + guide ([`Landing and Guide.dc.html`](../../redesign/Landing%20and%20Guide.dc.html))

**What it is.** Public marketing page + product guide index.

**Current implementation.** [`app/page.tsx`](../../app/page.tsx) + [`app/guide/page.tsx`](../../app/guide/page.tsx) + per-slug guide pages.

**What works.** Replacing vanity stats ("40%", "10+") with honest proof ("One pipeline / Score don't guess / $20/mo") is correct positioning. Real feature set is preserved.

**What's broken or missing.**
- 🟡 **Headline direction** flagged open. Pick.
- 🟡 **9→ 6 features collapse** — flagged open. Pick before build.

**What's questionable.**
- "Pricing anchor" mentioned but $20/mo is from the honest-proof strip. Confirm pricing model unchanged.

**Reuse opportunities.** Existing guide MDX pipeline (Phase B). Existing landing components.

**Referenced but not provided.** N/A.

---

### 4.10 · S7 · Settings ([`Settings.dc.html`](../../redesign/Settings.dc.html))

**What it is.** 11 flat items regrouped into 4 sections: Personal · Organization · Hiring workflow · Data.

**Current implementation.** [`app/(dashboard)/settings/layout.tsx`](../../app/(dashboard)/settings/layout.tsx) — flat 10-item nav with role-based visibility (Profile = all, others = admin-only or owner-only). 11th item is `/subscription` (separate route — Billing is a redirect).

**What works.** 4-group regrouping reduces cognitive load. The grouping itself is sound: Personal (Profile / Notifications / Security) / Organization (Org / Team / Billing) / Hiring workflow (Custom fields / Email templates / Rejection reasons / Integrations) / Data (Audit log / Trash). Folding Subscription into Billing is correct (it's already a redirect).

**What's broken or missing.**
- 🔴 **Notifications and Security are new sub-pages.** Notifications doesn't exist in code; what settings does it own? Spec says "Notifications (NEW)" with no fields.
- 🔴 **Security sub-page splits MFA ownership.** Current: per-user MFA on `/settings/profile`, org policy on `/settings/organization`. New: per-user on Personal → Security. **But where does the org policy go?** Org → Org? Spec gap.
- 🔴 **Webhooks + Calendly sub-pages** — referenced as "+ Slack/Teams webhooks + Calendly sub-pages". These are working complex sub-pages (G-030, G-031) with 8-event toggles, OAuth flows, etc. Spec collapses them to a single line.
- 🟡 **Visibility model isn't addressed.** Current code has role-based hiding. New 4-group nav — do all groups show for all roles, or does Hiring workflow disappear for Members?
- 🟡 **Profile "language" field** — spec includes language picker. Current profile has no language selector (i18n is Phase 7, not shipped). Add or drop.

**What's questionable.**
- "MFA policy card" lives on Organization page currently; redesign description says it stays there. Then the new Security sub-page is per-user only. Confirm explicitly to avoid implementer guessing.

**Reuse opportunities.**
- All current sub-pages reusable. The change is the layout shell (`/settings/layout.tsx` nav structure) + one new Notifications page + one new Security page.

**Referenced but not provided.** Notifications sub-page contents. Security sub-page contents (vs current Profile page MFA section).

---

### 4.11 · S8 · Reports + Interviews ([`Reports and Interviews.dc.html`](../../redesign/Reports%20and%20Interviews.dc.html))

**What it is.** Reports tabs (Pipeline conversion / Time to hire / Sources) + Interviews list.

**Current implementation.** Reports: 3 sub-routes `/reports/pipeline`, `/reports/time-to-hire`, `/reports/sources` (G-029). Uses Recharts. Period selector works (7/30/90/365/all-time). Funnel renders correctly (not "black bars" per redesign claim — that's stale). Interviews: [`app/(dashboard)/interviews/page.tsx`](../../app/(dashboard)/interviews/page.tsx) — 298 lines, all features (type icons, status pills, Join links, filters).

**What works.** The Reports + Interviews pairing on one screen is sound IA. Stats strip on Interviews matches current pattern.

**What's broken or missing.**
- 🟡 **"Black funnel bars" complaint is stale.** Working funnel already uses the stage palette per `VACANCY_STATUS_COLORS`. Confirm the screenshot in the redesign is from a pre-G-029 build, then drop the complaint.
- 🟡 **"Conversion table uses real rates (no '---')"** — G-029 shipped this; no longer broken. Drop.
- 🟡 **Per-recruiter breakdown** — deliberately skipped per product roadmap (surveillance concern). Redesign doesn't mention; confirm preserved.
- 🟢 **"Honest empty states"** — already shipped per G-029.

**What's questionable.**
- Reports + Interviews on one screen — they're related but not the same screen. Current architecture has Reports in `/reports/*`, Interviews in `/interviews/*`. Merging UX → URL change → break existing deep-links.

**Reuse opportunities.**
- Recharts FunnelChart, period selector, stats strip, status pills.

**Referenced but not provided.** N/A.

---

### 4.12 · S9 · Interview scheduling ([`Interview Scheduling.dc.html`](../../redesign/Interview%20Scheduling.dc.html))

**What it is.** Interview scheduling form — candidate-first (vacancy derived from application).

**Current implementation.** [`app/(dashboard)/interviews/new/page.tsx`](../../app/(dashboard)/interviews/new/page.tsx) — 165 lines. Already supports both pre-fill paths via URL params (`?candidate=X&vacancy=Y`). Provider detection (Google Calendar / Zoom / Microsoft) drives the "auto-Meet/Zoom/Teams link" flag.

**What works.** The fix described in REDESIGN-DECISIONS Section 1 — "candidate-first" — is partially true. Current code accepts both pre-fill orderings; the redesign locks the **default** entry to candidate-first. That's a UX nudge, not a rebuild.

**What's broken or missing.**
- 🟡 **Spec doesn't address the standalone entry from `/interviews` page** (no pre-fill). Current behavior: both pickers. Redesign behavior?
- 🟡 **Calendar conflict detection** — multi-attendee, overlapping events. Not mentioned, not shipped. Mention as gap.

**What's questionable.**
- "Email the candidate" toggle — works today; redesign preserves. Fine.

**Reuse opportunities.**
- `InterviewForm` component, calendar provider detection helpers.

**Referenced but not provided.** N/A.

---

### 4.13 · S10 · AI + Terminology ([`AI and Terminology System.dc.html`](../../redesign/AI%20and%20Terminology%20System.dc.html))

**What it is.** A unified pattern for AI features (invoke → draft → review → confirm), terminology rules, calmer framing.

**Current implementation.** Per-feature, no unified pattern. Some features use orange "NOT REVIEWED" alarm tag (`AiJdSuggest`); others use neutral framing.

**What works.** Calm blue "AI draft · review before saving" is correct posture. Provenance tag "AI-assisted" persisting post-confirm is sound for compliance.

**What's broken or missing.**
- 🟡 **"RETIRE 'Incomplete'"** — see §2.11. Confirm the term is in current taxonomy before scoping; remove from spec if absent.
- 🟡 **Terminology pass scope** — every UI string in 60+ pages. Big sweep; needs its own checklist.
- 🟢 **"Badges = 8px not pills"** — visual rule, fine.

**What's questionable.**
- "No emoji" rule — confirmed in repo's existing `CLAUDE.md`: emojis disallowed unless asked. Consistent.

**Reuse opportunities.** Existing AI components — wrap in new tag/styling layer; don't rebuild.

**Referenced but not provided.** N/A.

---

### 4.14 · S11 · AI Fit Analysis ([`AI Fit Analysis.dc.html`](../../redesign/AI%20Fit%20Analysis.dc.html))

**What it is.** Post-application AI scoring against role's scorecard criteria. Strengths / "To verify" gaps / suggested screening Qs. Advisory only.

**Current implementation.** None. Closest is `AiSummaryPanel` (textual summary, no scoring against criteria) and `AiAssessmentSuggester` (suggests attributes, doesn't score candidates).

**What works.** The framing — "match against requirements, not against people" — is the only legally defensible posture under EU AI Act Annex III (employment AI is high-risk). The bias-guardrail (ignore name/age/gender/photo/origin) is right.

**What's broken or missing.**
- 🔴 **Blocked by EU AI Act framework.** Per `docs/1-product/roadmap.md` Phase 8: "Blocked on: building the EU AI Act risk-management framework for higher-risk features." The current six AI features sit under low-risk advisory framing. AI screening crosses into high-risk → requires risk management system, data governance, technical documentation, transparency obligations, human oversight, accuracy/robustness, registration in EU database. None of that exists yet.
- 🔴 **No model/provider/cost spec.** Which LLM? Token cost per application? Latency? Caching? Spec is silent.
- 🟡 **Feedback loop** — 👍👎 collected per analysis. Used how? Improves the prompt? Adjusts attribute weighting? Discarded?
- 🟡 **Org-level opt-out setting** mentioned but not designed.

**What's questionable.**
- "Collapsed by default in application" — fine.
- "Surfaced in Review mode" — but decision is "always a human keypress". Then why surface during a fast-triage mode that's about minimizing decisions? Either remove from Review or change Review's flow.

**Reuse opportunities.** Existing AI client + prompt patterns. None of the bias guardrails exist yet.

**Referenced but not provided.** EU AI Act compliance framework. Risk management system documentation.

---

## 5. Inconsistencies across screens

Issues that span screens, not contained in any one.

| ID | Inconsistency | Severity |
|---|---|---|
| CS-01 | "Pipeline" appears in nav (S1 top-level) AND in vacancy detail (S4 — implied "scoped board"). But Wave 2.4's tab structure has no Pipeline tab. Either the route stays as `/vacancies/[id]/pipeline` (deep-link), or it's a tab — pick. | 🔴 |
| CS-02 | Bulk actions exist in two places: global Pipeline (S1, bulk bar) and Vacancy → Candidates (current G-024). Both keep? Conflicting muscle memory. | 🟡 |
| CS-03 | Saved views removed from Vacancies (S3) but not addressed for Candidates list (current G-026 covers both). One regression note instead of two. | 🟡 |
| CS-04 | Search: cmd-K global (S1 topbar) + per-list search bars (S3, S2). Two search affordances. Which one is canonical for "find a candidate"? | 🟡 |
| CS-05 | "Scorecard" used three ways: vacancy-config scorecard (S4), per-interview filled scorecard (S2), public scorecard share URL (current G-025, unmentioned). Lock the noun: `Scorecard template` vs `Scorecard submission` vs `Shared scorecard`. | 🟡 |
| CS-06 | "Stage" used three ways: `application_statuses` row (global), `pipeline stage` (per-vacancy in redesign), stage `type` (Standard / Interview / Offer / Review). Lock: `Stage = a step in a vacancy's pipeline`. `Type = the category that drives behavior`. `Status = the candidate-derived state (Active/Hired/Archived)`. | 🟡 |
| CS-07 | "Application" vs "Candidate" terminology overlap on UI labels. Current uses both inconsistently. S10 should fix; it doesn't fully (still says "Active candidates" in some places). | 🟡 |
| CS-08 | Status colors not consolidated across screens. Current uses `VACANCY_STATUS_COLORS` for vacancies, stage palette for pipeline. Spec implies one shared palette. Confirm. | 🟡 |
| CS-09 | Action labels: "Advance to [next stage]" (S2 rail) vs "Move to stage" (S1 bulk bar) — same action, different verb. Pick one. | 🟢 |
| CS-10 | "Hired" status appears as a candidate-level derived status, an application stage code, and a section name (Pipeline column). Same word, three contexts. Distinguish in UI strings: e.g., "Hired (for [Role])" on candidate level. | 🟢 |

---

## 6. Mobile assessment

The redesign devotes one paragraph to mobile. For a product where the apply form is the primary mobile surface, this is undercooked. The four must-work-on-phone flows have dedicated design docs:

- [`mobile/apply-form.md`](mobile/apply-form.md) — `/apply/[token]`
- [`mobile/candidate-profile.md`](mobile/candidate-profile.md) — `/candidates/[id]`
- [`mobile/offer-approval.md`](mobile/offer-approval.md) — `/offer/[token]`
- [`mobile/today-interviews.md`](mobile/today-interviews.md) — viewing today's interviews

**Mobile gaps in the redesign itself:**

1. 🔴 **Apply form on mobile.** Most applies are on phones; the redesign treats this as a desktop-first form. CV upload on mobile (camera vs file picker vs paste-link) is not addressed. Turnstile placement on small viewports — invisible mode, fine, but error states need a thumb-reachable retry.
2. 🔴 **Offer approval is candidate-facing email link.** Approving an offer from a phone is the most likely path. Countdown visibility on a 375px viewport — not specified.
3. 🔴 **Today's interviews — recruiter checks between meetings.** Pipeline-first global pipeline is desktop-by-nature; recruiters on phones need a different surface. The dropped "Today" dashboard would have been this; rebuild the need.
4. 🟡 **Candidate profile on mobile** — rail collapses below content per spec, but the stage-contextual block (Screening / Interview / Offer) is a multi-section UI that doesn't trivially fit a single column. Detailed sketch in `mobile/candidate-profile.md`.
5. 🟡 **Pipeline kanban on phones is not a kanban.** Spec says "single-column stage-switcher" — fine concept, no spec. The all-roles board concept doesn't translate.
6. 🟡 **Bulk action bar on touchscreens** — no detail.
7. 🟢 **Settings sub-pages on mobile** — acceptable to degrade (low-frequency, low-stakes from a phone).

See each mobile doc for sketches + interaction notes.

---

## 7. Feasibility flags

Items the redesign assumes are cheap but aren't. **Updated 2026-06-16** with locked-decision impact.

| Feature | Redesign assumption | Reality | Locked outcome |
|---|---|---|---|
| Custom stages with type model | `M` effort | Per-vacancy free-form would have been `XL`. **Per-vacancy with cap-10 + enum-restricted types** (locked: Q3) is `L`. Still needs schema design (Phase 0.5) but the cap removes overflow UI and the enum removes free-text-to-behavior mapping bugs. | `L` effort. Greenfield — no migration of existing apps. |
| Scorecard model rebuild | New feature | Existing tables would have required migration. **Locked: greenfield (Q14)**. Build the new scorecard model from scratch; existing `vacancy_questions` / `candidate_evaluations` / `candidate_evaluation_answers` get rebuilt with `must_have` + `recommendation` + 1–5 scale. | `L` effort. No data preservation. Public `/scorecard/<token>` URL contract is also greenfield. |
| Global Pipeline at scale | `L` effort | `L` + perf engineering — virtualization or hard pagination needed at 1000+ apps across all roles | **Unchanged.** Mandate virtualization (`@tanstack/react-virtual`) per column. |
| AI Fit Analysis (S11) | `M` effort, Wave 3.1 | Originally flagged as blocked by EU AI Act framework. **Locked: not blocked** — ship with [six guardrails](ai-fit-analysis.md#3-the-six-guardrails) + legal consult (Phase 0.8). | `L` effort (guardrails are real engineering). See [`ai-fit-analysis.md`](ai-fit-analysis.md). |
| 5-tab Vacancy detail (S4) | Visual restructure | Audit said the Candidates tab disappears with no replacement. **Locked: applications list moves to `/vacancies/[id]/pipeline`** (deep-link route from Q2). Vacancy detail Overview gets a "Candidates peek" top-5 list + "View pipeline →" header button. Confirmed by user-uploaded `Vacancy Detail.dc.html`. | `L` effort. No 6th tab needed. |
| Wizard creation (S4c/d) | "Both paths" UX win | Originally conflicted with A-005 RHF migration. **Locked: stepped wizard (Q13)**. Greenfield form rebuild — no RHF-migration coordination needed since no existing form is preserved. | `M` effort. |
| Notifications + Security settings sub-pages | Listed as "NEW" | Notifications page has no contents spec; **Security split locked (Q8)** — per-user MFA at Personal → Security, org policy stays at Organization → Security policy card. | Notifications still needs field-list spec; Security split is unblocked. |
| Public scorecard share URL migration | Not addressed | Originally a 🔴 — G-025 shipped tokens that the rebuild would break. **Locked: greenfield (Q14)** — no existing tokens to preserve. | No migration. |
| Saved views removal | "Redundant at 5–30 scale" | Originally a 🔴 — G-026 is a working shipped feature. **Locked: keep (Q6)** — extend `saved_views` with `'pipeline'` list_kind. | Unchanged feature; no removal. |
| Candidate Merge | Mentioned in header `⋯`, no spec | Was an open feature. **Locked (Q10):** 3-step confirm flow (pick duplicate → resolve identity-field conflicts → confirm); applications/notes/activity/documents/interviews/scorecards combine; identity fields chosen per-conflict; same-vacancy collision keeps furthest-along; audit log + redirects. | `M` effort. Plus the spec is locked, not just the existence. |
| Pipeline 0-vacancies state | Originally I recommended redirect | **Locked: full welcome card** with "Create your first vacancy" CTA + 3-step orientation (per user-uploaded `Pipeline Empty State.dc.html`). | `S` effort. New design file in `redesign/`. |

---

## 8. Open questions — RESOLVED 2026-06-16

All 14 are answered. See [§0 Status](#0-status--decisions-locked) for the locked decision table. Historical question list preserved below for reference.

1. ✅ **"Today" dashboard** — Dropped. Reports covers the overview need.
2. ✅ **Pipeline scoped to vacancy detail** — Keep both URLs. `/pipeline` is global; `/vacancies/[id]/pipeline` is a deep-link route to the same component pre-filtered.
3. ✅ **Custom stages with `type`** — Per-vacancy, max 10 stages, types restricted to enum (`standard / interview / offer / review`). Effort `L`. Greenfield (no migration).
4. ✅ **Scorecard migration** — No migration. Greenfield rebuild. New scale = 1–5, new fields = `must_have` + `recommendation` + `reason`.
5. ✅ **AI Fit Analysis (S11)** — Not blocked. Ships with [six guardrails](ai-fit-analysis.md#3-the-six-guardrails) + legal consult. See [`ai-fit-analysis.md`](ai-fit-analysis.md).
6. ✅ **Saved views (G-026)** — Keep. Extend `saved_views` with `'pipeline'` list_kind.
7. ✅ **Settings — Notifications page contents** — Confirmed new sub-page. Field-list spec is a small follow-up Phase 0 task.
8. ✅ **Settings — Security MFA split** — Split as designed in the user-uploaded `Settings.dc.html`. Per-user MFA at Personal → Security; org policy at Organization → Security policy card.
9. ✅ **Vacancy detail — applications list** — No Candidates tab. List lives at `/vacancies/[id]/pipeline`. Overview gets a "Candidates peek" top-5 list + "View pipeline →" header button.
10. ✅ **Candidate Merge** — Kept with full spec (3-step confirm, union of activity/applications/etc., chosen identity fields, same-vacancy collision rules, audit log + redirects).
11. ✅ **Repeat-applicant banner** — 3+ rejections threshold.
12. ✅ **Screening manual gate** — Folded into stage move. No separate Yes/No control. Confirmed by user-updated `Candidate Profile A Refined.dc.html`.
13. ✅ **Wizard vs single-scroll creation** — Stepped wizard.
14. ✅ **Mobile pipeline** — Combine: single-column stage-switcher for the global board on phone + Review mode is the canonical mobile pipeline pattern.

**Plus the 5 S1 sub-questions** (from [`flows/S01-pipeline.md` §7.5](flows/S01-pipeline.md#75-sub-questions-surfaced-by-this-analysis)):

- Q-S01-a (`BulkMoveDialog` client-loop vs server action) — confirm at build time.
- Q-S01-b ✅ Review mode also per-vacancy, not global-only.
- Q-S01-c ✅ Stale threshold = hardcode 5 days.
- Q-S01-d ✅ Bulk Schedule with N>1 selected = hide the button.
- Q-S01-e ✅ `/pipeline` with 0 vacancies = welcome card design (NOT redirect). New file `redesign/Pipeline Empty State.dc.html` is the canonical spec.

---

## Appendix A — files extracted to `redesign/`

The full redesign package is extracted (gitignored) at [`/redesign/`](../../redesign/). Canonical screen files:

| Spec | File | Status |
|---|---|---|
| S1 | `Pipeline Versions.dc.html` | canonical |
| S2 | `Candidate Profile A Refined.dc.html` | canonical |
| S3 | `Vacancies.dc.html` | canonical |
| S4 | `Vacancy Detail.dc.html` | canonical |
| S4b | `Custom Stages.dc.html` | canonical |
| S4d | `Create Vacancy Steps.dc.html`, `Create Candidate Steps.dc.html` | canonical |
| S5 | `Public Pages.dc.html` | canonical |
| S5c | `Public Offer.dc.html` | canonical |
| S6 | `Landing and Guide.dc.html` | canonical |
| S7 | `Settings.dc.html` | canonical |
| S8 | `Reports and Interviews.dc.html` | canonical |
| S9 | `Interview Scheduling.dc.html` | canonical |
| S10 | `AI and Terminology System.dc.html` | canonical |
| S11 | `AI Fit Analysis.dc.html` | canonical |

Exploratory drafts (do not implement against) — **moved to `redesign/_drafts/` on 2026-06-17 per Phase 0.4:**
- `Pipeline Directions.dc.html`
- `Candidate Profile Directions.dc.html`, `Candidate Profile Versions.dc.html`, `Candidate Profile Detailed.dc.html`
- `Create Flows.dc.html` (superseded)

## Appendix B — what comes next

After you read this audit:

1. **Resolve §8 open questions** — ideally in writing, ideally on the spec docs themselves.
2. **Read [`roadmap.md`](roadmap.md)** — the revised roadmap with KEEP / REVISE / DROP / ADD verdicts and a proposed Phase 0 of pre-work.
3. **Then we go flow-by-flow** — one screen per session, in the order: S1 Pipeline → S4 Vacancy detail → S4d Creation flows → S2 Candidate profile → S9 Interview scheduling → S5 Public pages → S5c Public offer → S7 Settings → S8 Reports → S10 AI/terminology → S11 AI Fit (last, blocked).

Mobile docs are produced alongside this audit at [`mobile/`](mobile/).

---

## Appendix C — G-022 → G-032 feature reconciliation (Phase 0.3)

Per [`phase-0-kickoff.md` §0.3](phase-0-kickoff.md#03--reconcile-g-022--g-032-features-with-redesign). For each post-design-package feature shipped to the product roadmap, the redesign home is identified below. **Closes audit §2.5 (🔴 features shipped post-design-package not reconciled).**

| G-ID | Feature | Today | New IA home (post-redesign) |
|---|---|---|---|
| **G-021** | @-mentions in candidate notes | candidate profile notes composer | [S02 §2.6 Activity feed](flows/S02-candidate-profile.md#26-left-column-structure-final) — preserved unchanged |
| **G-022** | Self-withdraw on `/status/[token]` | public status page button | [S05 §2.3 Status page](flows/S05-public-pages.md#23-status-token--candidate-tracker) — preserved verbatim (was a 🔴 audit gap RR-11) |
| **G-023** | cmd-K global search | topbar | S01 topbar (preserved); global Pipeline header gets same cmd-K affordance |
| **G-024** | Bulk move-to-stage | vacancy → Candidates tab | **Moves to [S01 Pipeline](flows/S01-pipeline.md#4-reuse-opportunities-dont-rebuild)** — Candidates tab is removed per Q9. `BulkMoveDialog` + `BatchRejectionDialog` lift unchanged into the new global Pipeline bulk action bar |
| **G-025** | Scorecard share `/scorecard/[token]` | recruiter generates from candidate profile | [S02 §2.5 Interview-stage contextual block](flows/S02-candidate-profile.md#25-stage-contextual-block-the-new-construct) action "Share scorecard". **Greenfield rebuild per Q14** — no existing tokens to preserve |
| **G-026** | Saved filter views | candidates + vacancies list | **Preserved + extended** with `'pipeline'` list_kind per [S01 §4](flows/S01-pipeline.md#4-reuse-opportunities-dont-rebuild) |
| **G-028** | CSV import `/candidates/import` | admin-only wizard | Preserved as top-level admin route — separate from new IA, accessed via Settings or direct URL |
| **G-029** | Reports (`/reports/*`) | three sub-tabs | [S08 Reports](flows/S08-reports.md) — preserved + custom-stages funnel adaptation per Q-S8-a (canonical 5-bucket) |
| **G-030** | Slack/Teams webhooks (`/settings/integrations/webhooks`) | admin webhook config | [S07 §2.9 Hiring workflow → Integrations](flows/S07-settings.md#29-hiring-workflow-group-4-pages-all-unchanged-content) — preserved under the new grouping |
| **G-031** | Calendly (`/settings/integrations/calendly`) | admin OAuth + scheduling links | Same |
| **G-032** | 2FA / TOTP | per-user MFA on `/settings/profile` + org policy on `/settings/organization` | **Per Q8 split**: per-user enrollment moves to [S07 §2.5 Personal → Security](flows/S07-settings.md#25-personal--security-new--locked-q8-split); org policy stays at [Organization page](flows/S07-settings.md#26-organization--organization-modify-light) |

Plus one retired feature explicitly: **G-015 email drafter** — retired 2026-06-21 per product roadmap. Confirmed absent from redesign.

**Wave-1 implication:** None of the 11 features are dropped. Wave 2.3 (S02 profile rebuild) preserves G-021/G-025; Wave 2.1 (S01 Global Pipeline) absorbs G-024; Wave 1.2 (S07 Settings regroup) preserves G-019/G-020/G-030/G-031/G-032 under new headings.
