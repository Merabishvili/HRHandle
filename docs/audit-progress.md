# Deep Audit — Progress Tracker

> **Canonical multi-session tracker.** Re-read this file at the START of every session and after any chat compaction. It is the source of truth for what's done, in progress, and next. Update it as work completes (check boxes, move the "RESUME HERE" pointer). Runs against `docs/audit-prompt.md`.

_Last updated: 2026-07-20_

## ▶ RESUME HERE (next task)

**Phase 1 — Documentation Refresh.** Go through each core `/docs` file, verify claims against current code, mark drift (🆕 added / ❌ removed / 🔄 changed), bump "Last updated". Work top-down through the "Phase 1 checklist" table below; the next unchecked row is the next task. **Next: `docs/3-architecture/backend.md`** (verify vs. the split action barrels applications/offers) then `database.md` (verify vs. migrations).

Method reminder: this is a *drift-detection* refresh, not cosmetic date bumps — read the doc, compare to code, fix what's actually stale. No browser is available (mobile findings stay static).

---

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 — Clarification | ✅ Done | All 5 phases / delete-safe / static-mobile confirmed. |
| 1 — Documentation Refresh | 🟡 ~30% | env + endpoints verified against code; ~24 core docs still to pass. |
| 2 — Issue & Improvement Discovery | 🟡 ~50% | Category pattern-scans + spot-checks done → 10 issues (all fixed). Deep per-file / per-route pass outstanding. |
| 3 — Issue Output Format | ✅ Done | `issues-found.md` re-audit section w/ required tables + summary. Keep appending as new issues surface. |
| 4 — Test Coverage | 🟡 ~40% | ~50 tests added; `new-tests.md`/`tests-to-remove.md` written. `test-cases.md`/`test-values.md` NOT updated; ~16 helpers still untested. |
| 5 — Cleanup | 🟡 ~70% | Dead toast system removed; `cleanup-candidates.md`/`cleanup-log.md` written. Deeper unused-export / orphan sweep outstanding. |
| Mobile audit | ✅ Done (static) | `mobile-compatibility.md`, all routes. Pixel-verify when a browser tool exists. |

**Beyond audit scope (also shipped this session):** every found issue FIXED (B-201 Toaster, MO-201/202/203, A-202 last `any`, AC-201), and **A-201 all 5 large-file splits** (applications/offers/interview-form/step-scorecard/cross-vacancy-board).

---

## Phase 1 checklist — per-doc refresh

Verify each against code; mark ✅ when done this audit. (`docs/redesign/*` = historical, skip. `audit-prompt.md`, `claude-code-workflow.md`, and the audit-output files = not subject to refresh.)

| Doc | Status | Notes |
|---|---|---|
| 1-product/overview.md | 🟡 partial | Removed dead `use-toast.ts` ref. Full pass pending. |
| 1-product/features.md | ⬜ | |
| 1-product/roadmap.md | ✅ | Phase 9 + A-002/005/201 updated. |
| 1-product/outstanding-2026-07.md | ⬜ | May be stale vs. current state. |
| 2-business/processes.md | ⬜ | |
| 2-business/roles-permissions.md | ⬜ | |
| 3-architecture/overview.md | 🟡 partial | Dead toast ref removed. Verify file tree vs. current. |
| 3-architecture/frontend.md | ✅ | RHF forms + candidates split + toast note. |
| 3-architecture/backend.md | ⬜ | Verify vs. split action files (applications/offers barrels). |
| 3-architecture/database.md | ⬜ | Verify vs. migrations (work_mode, language, scorecard reviewer, etc.). |
| 4-integrations/*.md (12 files) | ⬜ | Verify each service still wired as described. |
| 5-environment/variables.md | ✅ | Rewritten vs. `lib/env.ts`: ❌ LinkedIn vars, 🆕 Calendly, 🔄 Gemini/Cron/Sentry/Turnstile now validated. |
| 5-environment/local.md | ⬜ | |
| 6-deployment/ci-cd.md | ⬜ | |
| 6-deployment/process.md | ⬜ | |
| 7-api/endpoints.md | ✅ | All 27 route handlers reconciled + covered (10 added last pass). |
| 8-decisions.md | ✅ | RHF decision added. |
| 9-compliance/ai-features.md | ⬜ | |
| 9-compliance/{breach-response,ropa,sanctions-screening}.md | ⬜ | |
| ui-texts.md | ⬜ | Full UI-text inventory refresh. |

---

## Phase 2 — areas swept vs. outstanding

| Area | Deep-audited? | Notes |
|---|---|---|
| Security: XSS, public secrets, getSession, IDOR spot-checks | ✅ | AI routes IDOR-safe; no secret leaks. |
| Admin-client authz (all ~40 sites) | ⬜ | Only candidate-summary read verified in depth. **Sweep all 40.** |
| Route handlers (all 29) | ⬜ | Not individually audited. |
| Bugs / dead code / TODO / console / any | ✅ | 0 TODO, 1 justified any (now fixed), Toaster bug found. |
| Perf (N+1, indexes) | 🟡 | Bulk loops reviewed (accepted). DB index review outstanding. |
| Business-logic edge cases | ⬜ | Per-flow edge-case pass outstanding. |
| Config / env fallbacks | 🟡 | Spot-checked. |
| Accessibility (per-page) | 🟡 | MFA QR fixed; full a11y sweep outstanding. |

---

## Phase 4 — test backlog (untested pure helpers to write)

Written this audit: `list-derivation`, `stage-style`, `bucket`, `vacancy`/`candidate` form schemas, `interview-form-helpers`, `scorecard-shared`, `cross-vacancy-derivation`.

Still untested (from `new-tests.md`): `lib/permissions.ts`, `lib/offers/state.ts`, `lib/offers/expiry.ts`, `lib/screening-questions/{knockout-condition,compute-flag}.ts`, `lib/candidate-merge/defaults.ts`, `lib/audit-log/filter.ts`, `lib/trash/impact.ts`, `lib/mfa/{policy,recovery-codes}.ts`, `lib/notes/mentions.ts`, `lib/search/query.ts`, `lib/candidate-import/{validation,parsing}.ts`, `lib/vacancy-questions/normalize.ts`, `lib/guides/loader.ts`.

Also outstanding: update `docs/testing/test-cases.md` + `test-values.md`.

---

## Session log

- **2026-07-20 (session 1)** — Phases 2/3/5 core + mobile + fixes + A-201 (all 5 splits). Tests 862 → 930. Set up this tracker.
- **2026-07-20 (session 2)** — Phase 1 started: `variables.md` rewritten vs `lib/env.ts` (real drift: LinkedIn removed, Calendly added, validation list corrected); `endpoints.md` reconciled (27 routes covered). Next: `backend.md` + `database.md`.
