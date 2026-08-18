# Cleanup Candidates

_Last updated: 2026-07-20_

Removal candidates found during the deep re-audit. **Confidence: "Safe to remove"** = verified zero references, deletion applied this pass (see `cleanup-log.md`). **"Needs review"** = left untouched pending your confirmation.

## ✅ Safe to remove — DELETED this pass (see cleanup-log.md)

| Path | Reason | Confidence |
|---|---|---|
| `hooks/use-toast.ts` | Legacy shadcn toast hook. Only importer was `components/ui/toaster.tsx` (itself dead). App uses `sonner`. | Safe — removed |
| `components/ui/use-toast.ts` | Duplicate of the hook; **zero** importers anywhere. | Safe — removed |
| `components/ui/toaster.tsx` | Legacy `<Toaster>` renderer; zero importers (not mounted in any layout). | Safe — removed |
| `components/ui/toast.tsx` | Radix toast primitives; only imported by the two dead files above. | Safe — removed |
| `@radix-ui/react-toast` (dependency) | Used only by the deleted `components/ui/toast.tsx`. | Safe — `npm uninstall`ed |

## 🔍 Needs review — NOT touched (your call)

| Path | Reason to consider | Why not auto-removed |
|---|---|---|
| `docs/1-product/outstanding-2026-07.md` | Snapshot doc "as of 2026-07-04"; the migration checklist + manual steps may now be partially done. | It's a live tracking doc, not dead — may still be actively referenced. Confirm before pruning. |
| `docs/redesign/*` (audit.md, fidelity-audit.md, phase-0-kickoff.md, tech-debt.md) | The redesign project is ~complete (per `docs/redesign/roadmap.md`); some sub-docs may be historical. | Historical/reference value; not code. Prune only if you want a leaner docs tree. |
| Large action/component files (A-201 in issues-found) | `applications.ts` (1081), `offers.ts` (771), `interview-form.tsx` (771), etc. | These are *refactor* candidates, not deletions — no dead code, just size. Tracked as A-201, not here. |
| `redesign/` (repo-root, gitignored) + `"Redisign New.zip"` + `r8kel9lt` (untracked, repo root) | Source handoff artifacts / stray files in the working tree. | Untracked/gitignored — outside the committed codebase; delete manually if unwanted. Not removed by this audit. |

## Notes

- **No unused npm dependencies** were found beyond `@radix-ui/react-toast` (checked every entry in `package.json` `dependencies` against imports).
- **No orphaned assets** flagged in `public/` beyond what's referenced (icons/og-image are all referenced by `app/layout.tsx` metadata).
- **No commented-out code blocks** or leftover `console.log` (only 1 legitimate `console.log` in the purge-deleted cron).
