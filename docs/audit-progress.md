# Deep Audit — Progress Tracker

> **Canonical multi-session tracker.** Re-read this file at the START of every session and after any chat compaction. It is the source of truth for what's done, in progress, and next. Update it as work completes (check boxes, move the "RESUME HERE" pointer). Runs against `docs/audit-prompt.md`.

_Last updated: 2026-07-20_

## ▶ RESUME HERE (next task)

**Phase 1 — Documentation Refresh.** Go through each core `/docs` file, verify claims against current code, mark drift (🆕 added / ❌ removed / 🔄 changed), bump "Last updated". Work top-down through the "Phase 1 checklist" table below; the next unchecked row is the next task. **Next: `docs/9-compliance/` (ai-features, breach-response, ropa, sanctions-screening) + `docs/6-deployment/process.md` + `docs/ui-texts.md`.** Deeper follow-ups: `database.md` per-table body rewrite; deep per-file read of the 12 integration docs (low priority — config-stable).

Method reminder: this is a *drift-detection* refresh, not cosmetic date bumps — read the doc, compare to code, fix what's actually stale. No browser is available (mobile findings stay static).

---

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 — Clarification | ✅ Done | All 5 phases / delete-safe / static-mobile confirmed. |
| 1 — Documentation Refresh | 🟡 ~65% | + ci-cd.md rewritten; integrations spot-verified. Remaining: 6-deployment/process.md, 9-compliance, ui-texts, database body. |
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
| 1-product/overview.md | ✅ | Dashboard→Pipeline fixed; Offers/Reports/Scorecards modules + changelog added. |
| 1-product/features.md | ✅ | "Shipped since 2026-05-08" changelog block added. |
| 1-product/roadmap.md | ✅ | Phase 9 + A-002/005/201 updated. |
| 1-product/outstanding-2026-07.md | ⬜ | May be stale vs. current state. |
| 2-business/processes.md | ✅ | Pipeline-home + offer/2FA/reports/import process notes added. |
| 2-business/roles-permissions.md | ✅ | Newer owner/admin-gated surfaces + isOrgAdmin note added. |
| 3-architecture/overview.md | 🟡 partial | Dead toast ref removed. Verify file tree vs. current. |
| 3-architecture/frontend.md | ✅ | RHF forms + candidates split + toast note. |
| 3-architecture/backend.md | ✅ | Action-file inventory reconciled (20 missing files added; applications/offers barrels documented). |
| 3-architecture/database.md | 🟡 changelog | 2026-07 migration deltas + mid-2026 feature tables documented in changelog; per-table body rewrite still pending. |
| 4-integrations/*.md (12 files) | 🟡 spot | No integration removed; Calendly covered in `phase-5-manual-steps.md`; `google-generative-ai.md` covers the 6 AI features. Deep per-file read = low-priority follow-up. |
| 5-environment/variables.md | ✅ | Rewritten vs. `lib/env.ts`: ❌ LinkedIn vars, 🆕 Calendly, 🔄 Gemini/Cron/Sentry/Turnstile now validated. |
| 5-environment/local.md | ⬜ | |
| 6-deployment/ci-cd.md | ✅ | **Rewritten** — CI workflow (lint+test+build on push/PR) now documented (doc had claimed no CI existed). |
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
- **2026-07-20 (session 2)** — Phase 1 (9 docs): `variables.md`, `endpoints.md`, `backend.md` (+20 action files), `database.md` changelog, `1-product/{overview,features}`, `2-business/{processes,roles-permissions}`, **`ci-cd.md` rewritten** (found: CI workflow exists but doc said it didn't). Integrations spot-verified. Next: 9-compliance + 6-deployment/process + ui-texts.
