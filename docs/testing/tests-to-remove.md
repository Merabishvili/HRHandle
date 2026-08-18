# Tests to Remove

_Last updated: 2026-07-20_

Candidates for removal: duplicate, obsolete, testing removed/dead code, or always-passing/no-coverage tests.

## Re-audit 2026-07-20

**None found requiring removal.** The suite (74 files, 889 tests before this pass → 908 after) was reviewed:

- No `.skip` / `.todo` / `.only` or empty test bodies found.
- No tests reference the deleted legacy toast files (`hooks/use-toast.ts`, `components/ui/{use-toast,toaster,toast}.tsx`) — they had **no** test coverage, so nothing broke when they were deleted.
- No duplicate test files covering the same module twice.
- All test files map to live source modules.

### Watch item (not a removal — flagged for your review)

| File / test | Observation | Recommendation |
|---|---|---|
| `lib/__tests__/*` next/font-dependent tests, and any build-time-only assertions | The `next/font` Google Fonts fetch fails in offline sandboxes (environmental), not a test defect. | Keep. No action. |

If a future pass finds obsolete cases, list them here with: file + test name, reason, and whether safe to delete outright vs. needs confirmation — and do **not** delete unless clearly safe.
