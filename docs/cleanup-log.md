# Cleanup Log

Record of items actually deleted during audits. Append-only.

## 2026-07-20 — deep re-audit cleanup

Removed the fully-orphaned legacy Radix/shadcn toast system (the app uses `sonner`). Verified zero references across `app/`, `components/`, `lib/`, `hooks/`, `middleware.ts` before deleting. `tsc` = 0 errors after removal.

| Path | Reason | Date |
|---|---|---|
| `hooks/use-toast.ts` | Dead — only importer was the (also-dead) `components/ui/toaster.tsx`. | 2026-07-20 |
| `components/ui/use-toast.ts` | Dead — zero importers. | 2026-07-20 |
| `components/ui/toaster.tsx` | Dead — never mounted in any layout. | 2026-07-20 |
| `components/ui/toast.tsx` | Dead — only used by the two files above. | 2026-07-20 |
| `@radix-ui/react-toast` (package.json dependency) | Unused after the above deletions. Removed via `npm uninstall`. | 2026-07-20 |

**Net:** 4 source files + 1 dependency removed. No behavioural change (dead code). Note this does **not** fix B-201 (sonner `<Toaster/>` still needs mounting) — it only removes the unrelated legacy system.
