---
name: trilingual-change
description: Make any HRHandle user-facing text change in English, Georgian and Russian together - UI strings, emails, guide pages, legal pages. Use whenever a change adds or edits text a user, candidate or customer will read.
---

# Trilingual change (EN / KA / RU)

Every user-facing text exists in three languages. English is the source; KA and RU must say the same thing, not a looser paraphrase. Read `/mnt/project-files/kb/glossary.md` first and reuse its terms.

## Where text lives

| Kind | Source of truth | Check |
|---|---|---|
| App UI | `messages/source.json` — flat keys, `{ "en", "ka", "ru" }` side by side | `npm run messages:build` then `npm run messages:check` (fails on a missing KA/RU value or stale outputs) |
| Default emails | `messages/emails.source.json` | `lib/i18n/__tests__/messages.test.ts`, `lib/__tests__/email-i18n.test.ts` |
| Inline email strings | `lib/email.ts` (`*_STRINGS` records keyed by locale) | Same tests |
| Guide | `content/guides/{en,ka,ru}/<slug>.mdx`; titles/summaries/FAQ under `guide.*` in `messages/source.json`; topics in `lib/guides/registry.ts` | `__tests__/guides.test.ts` (same headings and `<Screenshot name>`s in the same order) |
| Legal | `components/legal/content/{terms,privacy,refund}-{en,ka,ru}.tsx`; numbers from `lib/legal/documents.ts` | `components/legal/__tests__/legal-content.test.tsx`; bump `LEGAL_UPDATED` |

Never edit `messages/en.json`, `ka.json` or `ru.json` by hand; they are built from `source.json`.

## Rules

1. Add or change the key in all three languages in the same edit. No `TODO` translations and no English placeholders in KA/RU.
2. Bold UI names in guide text must match that language's app label exactly; copy them from `messages/source.json`.
3. Candidate-facing text (apply form, status page, offer page, emails to candidates) uses the **organization's content language**, not the viewer's UI language. Check how neighbouring code picks the locale before adding a new string.
4. Money: never type `$`, `€` or `₾`; use `formatPrice` / `CURRENCY_SYMBOL` from `lib/pricing/currency.ts`. Georgian customers must see GEL.
5. Russian: watch grammatical case when a name or number is interpolated (`{name}`, `{count}`); use ICU plural forms for counts (one / few / many / other).
6. Georgian: the Interview stage is ინტერვიუ and the Interviews page is გასაუბრებები. The owner confirmed this split on 2026-10-19; keep it.
7. Legal pages: a change in one language means all three, plus `LEGAL_UPDATED`. KA/RU keep the "English prevails" note.
8. If you aren't sure a KA or RU phrase is natural, say so in your reply and list the phrases for the owner to check. Don't guess silently.

## Before you finish

```bash
npm run messages:build && npm run messages:check
npx vitest run __tests__/guides.test.ts components/legal lib/i18n lib/__tests__/email-i18n.test.ts
npm run lint
```

Changed guide screenshots need a capture run on the Mac (`npm run guide:seed`, `guide:serve`, `guide:screenshots`); see `docs/5-environment/local.md`. Say so if the change needs one rather than skipping it.
