# Outstanding Work & Manual Steps — as of 2026-07-04

_Snapshot after the 2026-07-03/04 fix batch + the 4 remaining code tasks. Companion to [`roadmap.md`](roadmap.md)._

Status legend: 🟢 ready to build · 🟡 blocked on a DB migration/config · 🔧 manual step (no code) · ✅ done

> **Update 2026-07-04:** all four "remaining code tasks" below (Language + avatar, Work mode, multi-reviewer scorecard, interview-questions cleanup) are now **built and pushed to `staging`**. They ship with new migrations that must be applied — see the checklist in §0.

---

## 0. Migrations to apply on **staging** (then production with the deploy)

All in `supabase/migrations/`. The code degrades gracefully before they're applied (pages load; the new features just don't work / fit scores blank), except where noted.

- ✅ `20260704_candidate_activity_stage_offer_events.sql` — applied
- ✅ `20260704_default_meeting_provider.sql` — applied
- ✅ `20260704_drop_saved_views.sql` — applied
- ⬜ `20260704_vacancy_work_mode.sql` — **needed** (vacancies list/detail/edit read `work_mode`)
- ⬜ `20260704_profile_language.sql` — **needed** (Profile page reads `language`)
- ⬜ `20260704_avatars_bucket.sql` — needed to enable avatar **uploads** (or create the `avatars` public bucket in the dashboard)
- ⬜ `20260704_drop_vacancy_interview_questions.sql` — optional cleanup (drops an unused column)
- ⬜ `20260704_scorecard_multi_reviewer.sql` — **needed** to enable scoring (candidate_evaluations gains reviewer_id/submitted + new constraints)

---

## 1. Manual steps — do these first (no code from me)

### 🔧 Apply 3 migrations on **production** Supabase
Already applied + verified on **staging**. The deployed code depends on them, so apply on the **production** project **before/with** the `staging → main` merge or the Integrations + New-Interview pages 500 and the Activity feed misbehaves.

```
supabase/migrations/20260704_candidate_activity_stage_offer_events.sql
supabase/migrations/20260704_default_meeting_provider.sql
supabase/migrations/20260704_drop_saved_views.sql
```
- First two are additive/safe. Third drops the unused `saved_views` table.
- Do **not** re-run older already-applied migrations (e.g. `20260517_organization_integrations`) — their `CREATE POLICY` statements aren't idempotent.

### 🔧 Fix Microsoft (Teams/Calendar) linking — Azure config
"Connect Microsoft" fails at the token exchange. The app now surfaces the real `AADSTS` error (see server logs / the new UI statuses), but the fix is **Azure-side** — check, in order, on the app registration:
1. **Client secret** — not expired, and the env var holds the secret **Value** (not the secret ID). Regenerate under _App registrations → Certificates & secrets_ and update **both** Vercel envs.
2. **Redirect URIs registered** — `https://staging.hrhandle.com/api/auth/microsoft/callback` **and** `https://hrhandle.com/api/auth/microsoft/callback`.
3. **Admin consent** for `Calendars.ReadWrite` / `OnlineMeetings.ReadWrite`.

Full checklist: [`docs/4-integrations/microsoft.md`](../4-integrations/microsoft.md) → Troubleshooting.

### 🔧 Rename the organization (candidate-facing)
Offer / status / apply pages correctly show `organizations.name` — but your org is literally named **"HRHandle Team"** in the DB, so that's what candidates see. Rename it in **Settings → Organization** and it updates everywhere candidate-facing. (Not a code bug — it's the org's configured name.)

### 🔧 Post-deploy verification (staging, then prod)
- Candidate **Activity feed** now shows **stage changes** + **offer** events (Offers filter chip).
- Offer stage shows the persistent **"Offer sent" summary** after Save & send.
- **"Default for video interviews"** selector appears in Settings → Integrations once ≥2 meeting tools are connected.
- A **/status/<token>** link (Track your application email) loads (no "no longer valid").

---

## 2. Remaining code tasks — ✅ all done (2026-07-04)

| # | Task | Status |
|---|---|---|
| 1 | **Profile → Language selector + avatar upload** | ✅ Language select + avatar upload (public `avatars` bucket + `uploadAvatar` action + optimistic preview). Migrations `20260704_profile_language.sql`, `20260704_avatars_bucket.sql`. |
| 2 | **Vacancy "Work mode" column** (Remote/Hybrid/On-site) | ✅ `work_mode` field on create wizard + edit form + detail + optional list column. Migration `20260704_vacancy_work_mode.sql`. |
| 3 | **Scorecard: multi-reviewer model** | ✅ Per-reviewer evaluations, 4-value recommendation, submitted/draft, anti-anchoring (others' cards hidden until you submit), fit score = average of submitted cards. Migration `20260704_scorecard_multi_reviewer.sql`. |
| 4 | **`vacancies.interview_questions` cleanup** | ✅ Route/action/lib/test deleted; type field removed; column dropped via `20260704_drop_vacancy_interview_questions.sql`. |

Nothing left on the code side from the 2026-07 batch — just apply the migrations in §0 and the manual steps in §1.

---

## 3. Done in this batch (for reference)

All shipped to `staging` and verified (tsc · lint · tests · build):

- **Bugs:** status-page 404 (dropped `application_statuses` join → now reads `pipeline_stages`); delete-candidate popup flicker; vacancy Duplicate silent no-op; ALL-CAPS names on Edit + Trash.
- **Pipeline:** role-filter multi-select + searchable overflow popover; List view stage-grouping + Fit data; Review Mode full rebuild (dark backdrop, rich card, 4 actions, Schedule overlay, completion).
- **Vacancy detail:** Scorecard/Interview merged into one AI panel; in-place **Score candidate** modal (was a redirect).
- **Candidate profile:** no-gate Screening checks; real inline Create-offer form; 5-stage tracker (Hired restored); **offer-sent summary** after send; "Additional information" hidden when empty.
- **Lists:** Candidate columns (+Stage/Fit/Location/Salary/Notice/Languages **+ org custom fields**); Vacancy columns (Employment type/Sector/Salary range/Health **+ custom fields**).
- **Settings:** Security current-session always shown; Team pending-invitations (Resend/Revoke) + member ⋯ menu; Profile email dedup; Notifications @mention lock; Rejection neutral form + Preview panel + reason-linkage; Audit-log dropdown filters + clickable entity IDs; Integrations Teams-vs-notifications copy + **default meeting provider** selector.
- **Public:** offer employer name fallback; Microsoft OAuth error now diagnosable.
- **Cleanup:** **Saved Views** feature removed end-to-end; generic placeholder hints (no personal info).
- **Migrations written + applied on staging:** activity-view (stage/offer events), default-meeting-provider, drop-saved-views.
