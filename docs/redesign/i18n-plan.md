# Internationalisation (i18n) — Implementation Plan

> **Status:** 📋 **Plan — no code yet.** Authored 2026-07-31. Covers the full `FIX-PROMPT-i18n-UI-and-Org-Language.md` bundle + `Language Settings Clean.dc.html` (4 screens). This is the execution roadmap for product-roadmap **Phase 7** ([`1-product/roadmap.md`](../1-product/roadmap.md#phase-7--multi-language-ui-i18n)) and redesign **S7 Settings** language surfaces.
>
> **Ground truth this plan is built on** (verified 2026-07-31): zero i18n plumbing today (no next-intl, no locale routing, no catalogs). `profiles.language` exists + a `Select` in [`profile-form.tsx`](../../components/settings/profile-form.tsx) but **nothing reads it** ("localization rolling out gradually"). Per-vacancy language is **hardcoded** `'English'` at [`vacancies/[id]/page.tsx:450`](../../app/(dashboard)/vacancies/[id]/page.tsx). ~184 of 305 `.tsx` files carry user-facing strings; roadmap estimate **2–3K strings**. All 6 AI features are English-only and several are explicitly told *"do not translate"*.

---

## 1. The two independent settings (non-negotiable framing)

The single most important design rule — and the acceptance criterion most likely to be violated by a careless build:

| | **Personal UI language** (§1) | **Org content language** (§2) |
|---|---|---|
| Who sets it | Every user, for themselves | Owners/Admins only |
| Stored on | `profiles.language` (per user) | `organizations.*_content_locale(s)` |
| Governs | App chrome only — nav, buttons, labels, toasts, table headers, Settings copy | Candidate-facing content + **AI-generated content language** |
| Never affects | Candidate pages, AI output language, other users' UI | The recruiter's own chrome |

These two are wired to **different locale sources** and must never be collapsed into one "locale". A recruiter whose UI is Russian, viewing a Georgian-default org, drafting a JD for an English vacancy, sees: **Russian chrome, English JD content, Georgian public apply page.** The plan is architected around keeping these resolvers separate from day one.

---

## 2. Architecture decisions

### 2.1 Library — `next-intl`
Standard for the Next.js 16 App Router; ICU MessageFormat (plurals, dates, numbers). Matches the roadmap's own pick.

### 2.2 Locale set — `en` · `ka` · `ru` (English default)
```ts
export const LOCALES = ['en', 'ka', 'ru'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
```
**Fix the current cosmetic bug:** the live selector offers 6 languages (`en/ka/ru/es/fr/de`) but can render none. Reduce it to the 3 real locales in Slice 0. `es/fr/de` return only when catalogs exist.

### 2.3 Routing model — **split** (the key call) · ✅ DECIDED 2026-07-31
- **Dashboard (authed):** **cookie-based** locale (`NEXT_LOCALE`), resolved from `profiles.language`. **No `app/[locale]/…` restructure** — that would rewrite the entire app tree and every internal link for zero SEO benefit on authed pages.
- **Public pages** (`/jobs`, `/apply`, `/offer`, `/status`, landing): **path-segment locale** — `/[locale]/jobs/[slug]` with `next-intl` `localePrefix: 'as-needed'` (English = no prefix, `ka`/`ru` get `/ka/…`, `/ru/…`) + `<link rel="alternate" hreflang>` alternates + per-locale entries in `sitemap.ts`. **Decision (Q2): invest in SEO now** — the user wants job pages to rank in ka/ru, so distinct indexable URLs per language are worth the public-route restructure. (Job pages aren't in the sitemap today — that gets fixed as part of this.)

**Why the split:** the dashboard is a private app → a cookie is ideal and avoids churn; public pages are SEO/shareable → they need a real per-locale URL Google can index. next-intl's middleware handles the public locale prefix; the dashboard opts out of prefixing and reads the cookie.

### 2.4 Locale resolution (source of truth per surface)
| Surface | Resolver | Fallback |
|---|---|---|
| Dashboard chrome | `profiles.language` → `NEXT_LOCALE` cookie | `en` |
| Public page content | `?lang` (if in vacancy's posting_locales) → visitor cookie → org `default_content_locale` | `en` |
| AI generated content | vacancy content locale → org `default_content_locale` (see §6) | `en` |
| Landing page (no session) | visitor cookie → **always `en`** (never browser/IP) | `en` |

### 2.5 Content model for per-vacancy variants (§3) — **JSONB per-locale** · ✅ DECIDED 2026-07-31 (Q3 confirmed)
Confirmed during planning; the tradeoff is stated below.

**Chosen: JSONB per-locale columns.** `description`, `requirements`, `responsibilities` (and the `label` on `vacancy_screening_questions` / `vacancy_questions`) become `LocalizedText`:
```ts
type LocalizedText = Partial<Record<Locale, string>>   // { en: "...", ka: "..." }
pickLocale(text, locale, DEFAULT_LOCALE)               // one shared util, with fallback
```
plus `vacancies.posting_locales text[]` for which locales this vacancy is published in.

| | JSONB per-locale (**chosen**) | `vacancy_translations` child table (rejected) |
|---|---|---|
| Reads | none extra — vacancy row already carries all locales | a join on every public render + every AI read |
| Writes | one row, patch a key | N rows per field per save |
| Fit to usage | a vacancy is almost always read **whole** → pick locale in memory | optimised for querying one field/locale, which we rarely do |
| Cost | TS types change `string → LocalizedText`; backfill `text → {en: text}` | stringly-typed EAV (`field` as text key); assembly queries |

Rationale: vacancies are read as a whole document, not queried by content field, so the join cost of a child table buys nothing. The one real downside — types flip from `string` — is contained by `LocalizedText` + a single `pickLocale()` helper. **Migration is two-step and reversible** (add `*_i18n` JSONB alongside, backfill, cut readers over, drop old columns in a later migration) so no big-bang cutover.

### 2.6 What is NOT translated
Candidate-typed data (notes, CV text, screening *answers*), the candidate `languages` field (unrelated — it's what the candidate speaks), and historical audit/log rows. Only **product chrome** (§1) and **org content surfaces** (§2/§3) are localised.

---

## 3. Schema changes (all idempotent, RLS-consistent with existing tables)

| Migration | Slice | Change |
|---|---|---|
| `…_org_content_locales.sql` | 2 | `organizations.default_content_locale text NOT NULL DEFAULT 'en'`, `organizations.enabled_content_locales text[] NOT NULL DEFAULT '{en}'`. (Reuse existing `profiles.language` for §1 — no new column.) |
| `…_vacancy_i18n_content.sql` | 4 (step 1) | Add `vacancies.description_i18n / requirements_i18n / responsibilities_i18n JSONB`, `vacancies.posting_locales text[] DEFAULT '{en}'`; add `vacancy_screening_questions.label_i18n JSONB`, `vacancy_questions.label_i18n JSONB`. Backfill each `_i18n` = `{"en": <existing text>}`. **Old columns kept.** |
| `…_vacancy_i18n_drop_legacy.sql` | 4 (step 2, later PR) | After all readers/writers use `_i18n`, drop the legacy `text` columns. |

No schema change for §1, §3b, or §4 (§4 is prompt/param only). Email templates (candidate-facing) localise via catalog + org locale, no schema change.

---

## 4. The slices (sequenced; each is its own PR with code + docs + tests)

### Slice 0 — Infra + de-cosmetic the selector · **S/M**
- Install + wire `next-intl`; `lib/i18n/` (`LOCALES`, `Locale`, `DEFAULT_LOCALE`, `pickLocale`, request config, cookie plumbing).
- Dashboard reads locale from `profiles.language` → `NEXT_LOCALE` cookie; provider in [`app/(dashboard)/layout.tsx`](../../app/(dashboard)/layout.tsx).
- Reduce `profile-form` selector to `en/ka/ru`; changing it sets the column **and** cookie and re-renders (no reload).
- **No strings translated yet** — `en.json` is the source, `ka.json`/`ru.json` start as stubs.
- **Tests:** locale resolution + fallback; `pickLocale`; a **catalog-completeness test** (every key in `en.json` exists in `ka.json`/`ru.json`) — this test guards the whole programme going forward.
- **Exit:** switching Profile → Language flips a proof-of-concept surface (nav) live.

### Slice 1 — Extract + translate Settings + global chrome · **M (pilot for the big sweep)**
- Extract all strings in `components/settings/**`, `settings-nav`, the app shell/nav/header, toasts, and shared `components/ui` copy into `en.json`; replace with `t()` calls.
- Produce **draft** `ka.json` / `ru.json` for this subset (flagged for native review — see §7).
- Proves the end-to-end pipeline on a bounded, high-value surface **before** committing to the full 2–3K-string sweep.
- **Exit:** Settings + nav fully render in ka/ru (pending review sign-off).

> **Slice 1b…1n — the full UI sweep.** The remaining ~2–3K strings (pipeline, candidates, vacancies, reports, dialogs, empty states) are extracted surface-by-surface in follow-up PRs using the Slice 1 pattern. Tracked as a checklist, not one mega-PR. This is the bulk of total effort and runs in parallel with Slices 2–6.

### Slice 2 — Org content-language settings (§2) · **M**
- Migration (§3 table above). `lib/actions/settings.ts` (or a new `org-locale` action): admin-gated `setOrgContentLocales(default, enabled[])`, mirroring the `setOrgMfaPolicy` owner-gate pattern.
- New **admin-only** Settings → Organization "Language" card (default single-select + "also available" multi-select), matching the design's Screen 2. Non-admins: hidden (consistent with other owner-only cards).
- **Tests:** action authz (member blocked), default must be within enabled set, at least `en` always enabled.

### Slice 3 — Public surfaces render in org content language (§3b landing rides along) · **L**
- `/jobs/[slug]`, `/apply/[token]` (+ screening questions), `/offer/[token]`, `/status/[token]`: resolve content locale (§2.4), render content in it, emit `hreflang` alternates, add a language switcher among the org/vacancy enabled locales.
- Candidate-facing **emails** (application received, interview invite, rejection, offer) localise to the org content locale.
- **§3b landing switcher:** EN/KA/RU in [`app/page.tsx`](../../app/page.tsx) nav; default always `en`; persist choice in a cookie; on sign-up, pre-fill `profiles.language` from it (changeable after).
- **Tests:** public page picks org default when no `?lang`; switcher constrained to enabled locales; landing defaults to `en` regardless of `Accept-Language`.

### Slice 4 — Per-vacancy multi-language content + picker (§3) · **L–XL, migration**
- Migration step 1 (§3 table). `LocalizedText` types + `pickLocale` everywhere the three vacancy bodies + screening/scorecard labels are read or written.
- Vacancy JD tab: language chip-row (design Screen 3) scoped to org enabled locales; per-language tabs for About/Responsibilities/Requirements; replace the **hardcoded `language: 'English'`** at [`vacancies/[id]/page.tsx:450`](../../app/(dashboard)/vacancies/[id]/page.tsx). Ripple into `vacancy-form.tsx` (RHF — coordinate with the A-005 schemas) + screening-question + scorecard editors.
- Public render + AI reads (Slice 5) consume `pickLocale`.
- Migration step 2 (drop legacy columns) as a separate later PR once nothing reads them.
- **Tests:** `pickLocale` fallback; a vacancy posted in `{en,ka}` renders each; screening questions localise; backfill correctness.

### Slice 5 — AI generation-language param (§4) · **M**
- Thread a `contentLocale` param through all 6 AI features (`jd-generator`, `bias-check`, `candidate-summary`, `note-extractor`, `assessment-suggester`, **`fit-analysis`**) + `parse-cv` where relevant. The engine generates **in the content locale**, not the recruiter's UI locale.
- **Resolve the "do not translate" contradiction:** today `candidate-summary`/`jd-generator`/`note-extractor` say *"keep the recruiter's language, do not translate."* New rule: **generated deliverables** (JD drafts, fit explanations) are produced in the **content locale**; features that *summarise recruiter/candidate free-text* (note-extractor, candidate-summary) keep source proper nouns but render their prose in the content locale. Bump each `*_PROMPT_VERSION`.
- Recruiter-facing AI **meta-copy** (button labels, "ADVISORY · review", banners) stays in the **UI locale** (§1) — only generated content follows the content locale.
- **Tests:** prompt includes the target-locale instruction; meta-copy vs content-locale separation; AI Fit `FIT_PROMPT_VERSION` bumped.

### Slice 6 — Cleanup + guardrails · **S**
- Lint rule / CI check flagging new raw JSX string literals (enforces "no hardcoded strings" going forward).
- Drop legacy vacancy content columns (Slice 4 step 2) if not already done.

---

## 5. Impact list (what the whole programme touches)

- **Deps:** `next-intl`.
- **New:** `lib/i18n/*`, **`messages/source.json`** (single reviewable catalog — every key carries `{ en, ru, ka }` side-by-side, per Q1), a generator (`scripts/build-messages.mjs`) that emits the per-locale **`messages/{en,ka,ru}.json`** next-intl consumes, org-locale action, org language settings card, public language switcher, landing switcher, `LocalizedText`/`pickLocale`.
- **Schema:** `organizations` (2 cols), `vacancies` (4 cols), `vacancy_screening_questions` + `vacancy_questions` (`label_i18n`); two vacancy migrations (add+backfill, then drop-legacy).
- **Heavily edited:** every `.tsx` with user-facing strings (~184 files, phased); `profile-form.tsx`; vacancy form + JD tab + screening/scorecard editors; all public pages + candidate emails; all `lib/ai/*` + AI routes.
- **Types:** `Locale`, `LocalizedText`; vacancy content types flip `string → LocalizedText`; ripple through `lib/validations/vacancy.ts` (coordinate with A-005 RHF schemas) and everywhere those fields are consumed.
- **Docs:** this plan; `9-compliance/ai-features.md` (AI language rule + prompt-version bumps); `3-architecture/database.md` (new columns); `8-decisions.md` (i18n architecture decision — cookie vs URL split, JSONB content model); `1-product/roadmap.md` Phase 7 → in-progress; new flow `redesign/flows/S07b-i18n.md`.
- **Tests:** catalog-completeness (ongoing gate), locale resolution + fallback, `pickLocale`, org-locale authz, public locale selection, landing default-en, AI content-locale.
- **Env:** none required.

## 6. AI generation language — precise rule (§4)
Generated **content** locale = vacancy content locale → org `default_content_locale` → `en`. Recruiter **meta-copy** locale = `profiles.language`. These are passed as two distinct values into every AI surface; a feature never infers one from the other. The AI Fit Analysis sanitiser is content-agnostic (it strips PII, not language) so it needs no change; only its **prompt** gains the target-locale instruction and a version bump.

## 7. Translation governance (§5) — the human gate
- Catalogs ship as reviewable `en/ka/ru.json`; **`en` is the source of truth.**
- `ka`/`ru` drafts are produced for review but **not shipped unreviewed** — a native speaker proofreads before each slice's locale is marked production-ready. Per §5: translate naturally (e.g. "Integrations" → "ინტეგრაციები"); **keep a term in Latin** when a native rendering would be forced/clunky — a per-term judgement call, not mechanical transliteration.
- The catalog-completeness test blocks a build if a key is missing in any locale (missing → falls back to `en` at runtime, but CI flags it so gaps are visible).
- **This human review is the true ship-gate for each locale** and is outside code control — plan the sweep so English ships first and ka/ru light up per-surface as reviews land.

## 8. Open questions / decisions — ✅ ALL RESOLVED 2026-07-31
1. **Native-speaker reviewer** — **the user reviews.** Translations are delivered as a single side-by-side `source.json` (`{ en, ru, ka }` per key) precisely so the user can proofread ka/ru against en in one place. Machine-draft-then-review is accepted; en ships as source, ka/ru go live per surface as the user signs off.
2. **Public URL locale** — **path segments, SEO-first** (§2.3). `/[locale]/…` for public pages via `localePrefix: 'as-needed'`; job pages get added to the sitemap per-locale.
3. **Vacancy content model** — **JSONB per-locale, confirmed** (§2.5).
4. **Scope** — **everything together, full coverage.** No dashboard-first deferral; the catalog covers all surfaces and ka/ru are expected at 100% before public launch (so #1's review throughput is the schedule driver).

## 9. Translation-first execution order (revised per the decisions)

> **Progress (2026-07-31): step 1 done, step 2 COMPLETE.** Foundation shipped
> (`lib/i18n/locales.ts`, `messages/source.json`, `scripts/build-messages.mjs`,
> `npm run messages:build`/`messages:check`, completeness test). The catalog now
> covers the **whole product** — **501** next-intl keys (`messages/source.json`)
> + **12** candidate email templates (`messages/emails.source.json`), all with
> `en`/`ru`/`ka` side-by-side, across 11 batches: chrome+settings, pipeline+review,
> candidates+profile, vacancies, reports+interviews, apply form, status+withdraw+
> jobs, public offer, landing, and emails. ICU plurals + apostrophe-hazards
> validated; ka/ru draft-complete and **awaiting native review** before going
> live. **Next: step 3 — wire next-intl + swap components to `t()`** + org/public/
> vacancy/AI behaviour (Slices 0/2/3/4/5 in §4).

The user chose **translation files first**. So the order is now:
1. **Foundation (no app wiring yet):** `lib/i18n/locales.ts`, `messages/source.json` (the reviewable catalog), `scripts/build-messages.mjs` (source → nested per-locale files), `npm run messages:build`, and a completeness check.
2. **Populate `source.json` surface-by-surface** with en + ru + ka until the whole product is catalogued (this is the long pole; the user reviews as it fills).
3. **Then wire** next-intl + swap components to `t()` + build the org/public/vacancy/AI behaviour (Slices 0/2/3/4/5 from §4).

`source.json` is the human-facing artefact; the generated `en/ka/ru.json` are build outputs next-intl reads. Sequencing/effort is **multi-week**, dominated by writing + reviewing ~2–3K × 3 strings — not the plumbing.

---

## 10. Slice 2 + 3b execution plan — org content language + public path routing

> Authored 2026-08-02, after the whole dashboard + landing were swapped to `t()`
> (551 keys live). This is the implementation-ready plan for the **last** i18n
> surface: the candidate-facing public pages. Two decisions are locked: (a) the
> org content language is a real setting with a schema + admin card; (b) public
> URLs use **path segments** `/[locale]/…` for SEO. **No code until this is
> approved** (the middleware change can affect auth/CSP if rushed).

### 10.1 Why these two slices are coupled
Candidate pages (`/apply`, `/status`, `/offer`, `/jobs`) render in the **org's
content language**, not the recruiter's UI cookie. So the org must be able to
*set* that language (Slice 2) before the public pages have anything to switch to
(Slice 3b). Order is strict: **2 → 3b**.

### 10.2 Slice 2 — org content language (safe half, one migration)

**Migration** `…_org_content_locale.sql` (idempotent; USER applies on staging → prod, like the AI Fit migration):
```sql
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS default_content_locale  text   NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS enabled_content_locales  text[] NOT NULL DEFAULT '{en}';
```
Invariants (enforced in the action, not the DB): `default_content_locale ∈ enabled_content_locales`; `'en'` is always enabled; every value ∈ `LOCALES`.

**Action** `setOrgContentLocales(defaultLocale, enabled[])` in `lib/actions/…`:
- Owner/admin-gated (mirror `setOrgMfaPolicy`).
- Validate the invariants above; audit-log `org_content_locale_updated`.
- `revalidatePath('/settings/organization')`.

**UI** `components/settings/org-language-card.tsx` (client, admin-gated) — matches design Screen 2: a **Default language** single-select + an **"Also available to candidates"** multi-select checklist over `LOCALES`. Reuses catalog keys already drafted (`settings.orgLang.*` — add if missing). Mounted on Settings → Organization; read the two columns in a **separate graceful query** (same pattern as AI Fit) so an unmigrated column can't break the page.

**Helper** `resolveOrgContentLocale(org, requested?)` in `lib/i18n/` — returns `requested` if it's in `enabled_content_locales`, else `default_content_locale`, else `en`.

**Tests:** action authz (member blocked), default-must-be-enabled, en-always-enabled, `resolveOrgContentLocale` fallback chain.

### 10.3 Slice 3b — public path-segment routing + candidate-page swaps

This is the architectural piece. Sub-steps, in order:

1. **next-intl routing config.** Add `lib/i18n/routing.ts` via `defineRouting({ locales: LOCALES, defaultLocale: 'en', localePrefix: 'as-needed' })` → English keeps clean URLs, `ka`/`ru` get `/ka/…`, `/ru/…`. Keep the existing cookie-based `i18n/request.ts` for the dashboard; the request config becomes locale-aware (reads the routing locale when present, else the cookie).

2. **Route move (public only).** Relocate the public trees under a `[locale]` segment:
   `app/jobs` → `app/[locale]/jobs`, and likewise `apply`, `offer`, `status`. The dashboard, `auth`, `api`, `onboarding` etc. **stay put** (no locale prefix). Add `app/[locale]/layout.tsx` that calls `setRequestLocale(locale)` (static rendering) + provides the locale; add `generateStaticParams` returning the three locales.

3. **Middleware composition — the risk point.** `middleware.ts` today does the CSP per-request nonce (`lib/security-headers.ts`) + Supabase session refresh + auth gates for every route. Change:
   - Build `intlMiddleware = createMiddleware(routing)`.
   - For requests whose path is a **public localizable route**, run `intlMiddleware` first; if it returns a redirect (locale negotiation), return it; otherwise **carry the CSP nonce onto its response** before returning.
   - For all other paths, run the existing middleware unchanged.
   - Update the `config.matcher` so both are scoped correctly (exclude `api`, `_next`, static assets; include public routes for intl).
   - **Explicitly verify:** the `x-nonce` request header + response CSP header are still present on public pages; the Supabase auth redirect still fires for the dashboard; no double-processing of `/api`.

4. **Candidate-page rendering in the content locale.** Each public page resolves its display locale = `resolveOrgContentLocale(org, params.locale)` and renders via `getTranslations({ locale })` (server) — the URL locale is *validated against the org's enabled set*, falling back to the org default. Then swap `apply-form` / status / offer / jobs strings to `t()` (catalog keys already exist: `apply.*`, `status.*`, `offer.*`, `jobs.*`, `withdraw.*`). The apply form's `{company}` interpolations already in the catalog.

5. **hreflang + sitemap.** Each public page's `generateMetadata` emits `alternates.languages` for the org's enabled locales. `app/sitemap.ts` gains per-locale entries — and **starts listing job pages at all** (they aren't in the sitemap today; this is the SEO win the path-segment decision is for).

6. **Candidate emails.** Make `DEFAULT_TEMPLATES` locale-aware from `messages/emails.source.json` (a `Record<Locale, …>`); the dispatcher picks the org's `default_content_locale`. This is separate from next-intl (Handlebars `{{role}}`/`{{company}}` untouched).

7. **Landing switcher tie-in.** On sign-up, pre-fill the new account's `profiles.language` from the visitor's `NEXT_LOCALE` cookie (design §3b), then it's independently changeable.

### 10.4 Risk register (Slice 3b)
- **Middleware order / CSP:** the nonce must survive the intl middleware path. Test the response headers on `/`, `/ka/jobs/x`, `/apply/x`, and a dashboard route before/after.
- **Auth untouched:** the Supabase session-refresh + dashboard gate must run exactly as today for non-public paths — the intl branch must never swallow them.
- **Static params:** `[locale]/layout` needs `setRequestLocale` or public pages lose static optimization / mis-render locale.
- **Locale ≠ enabled:** always validate `params.locale` against the org's enabled set; never render a locale the org disabled.
- **Reversibility:** the route move is the big diff; do it on a branch, verify the four public flows + a dashboard smoke test, and keep English URLs unprefixed so existing shared links keep working.

### 10.5 Suggested execution order
`Slice 2 (migration + action + card + tests)` → **user applies migration** → `Slice 3b step 1–2 (routing + route move)` → `step 3 (middleware) + header verification` → `step 4 (page swaps)` → `step 5 (hreflang/sitemap)` → `step 6 (emails)` → `step 7 (sign-up prefill)`. Each step gated by tsc/lint/build/tests as with every prior slice.
