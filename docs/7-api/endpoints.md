# API Endpoints

_Last updated: 2026-05-08_

## Changelog

- 🆕 `POST /api/parse-cv` — public CV-parsing endpoint (IP rate-limited, Gemini-backed)
- 🆕 `POST /api/integrations/linkedin/save` — store LinkedIn company-page integration
- 🆕 `POST /api/integrations/linkedin/disconnect` — remove LinkedIn integration
- 🔄 `GET /api/export/candidates` — column set expanded to include `Location`, `Timezone`, `Languages`, `Salary Expectation`, `Notice Period`, `Experience`, `Education` (was 10 cols, now 17)
- 🔄 `GET /api/export/applications` — column set expanded similarly (includes experience/education summary)
- 🔄 `POST /api/onboarding` — rate-limit claim corrected: route relies on DB-backed idempotency (`alreadyInitialized: true` if profile has `organization_id`); no in-memory counter
- 🔄 Microsoft OAuth — `/settings/integrations?microsoft=*` redirect path standardised (other providers still redirect to `/settings?google=*` / `/settings?zoom=*` — see open issue `BL-microsoft-redirect`)

---

All routes are in `app/api/`. Auth routes (`app/auth/confirm`, `app/auth/callback`) are also route handlers but listed separately.

---

## Health

### `GET /api/health`

**Auth required:** No  
**Purpose:** Liveness probe — confirms the Next.js function is serving requests. Intentionally does **not** check database or third-party dependency health (clients should subscribe to upstream status pages for those).  
**File:** `app/api/health/route.ts`

**Response (200):**
```json
{ "status": "ok" }
```

The endpoint cannot return non-200; if the Next.js function is unhealthy, the request fails to reach this handler and the platform returns its own error.

---

## Onboarding

### `POST /api/onboarding`

**Auth required:** Yes (Supabase session cookie)  
**Purpose:** Runs onboarding for the authenticated user — creates organization, profile, subscription, and seed data. Delegates to `lib/onboarding.ts`.  
**File:** `app/api/onboarding/route.ts`  
**Rate limited:** 5 attempts per user per 60 seconds (in-memory, resets on server restart)  
**Called by:** External use only — the dashboard layout calls `runOnboarding()` directly

**Request body:** None  

**Response (200):**
```json
{ "success": true, "alreadyInitialized": false }
```

**Response (401):** `{ "error": "Unauthorized" }`  
**Response (429):** `{ "error": "Too many requests. Please wait before retrying." }`  
**Response (500):** `{ "error": "..." }`

---

## Cron

### `GET /api/cron/expire-vacancies`

**Auth required:** `Authorization: Bearer {CRON_SECRET}` header (timing-safe comparison)  
**Purpose:** Calls Supabase RPC `expire_past_vacancies()` to auto-archive vacancies whose end date has passed  
**File:** `app/api/cron/expire-vacancies/route.ts`  
**Called by:** Vercel Cron (configured in Vercel dashboard)

**Response (200):**
```json
{ "ok": true, "ran_at": "2025-01-01T00:00:00.000Z" }
```

**Response (401):** `{ "error": "Unauthorized" }`  
**Response (500):** `{ "ok": false }`

---

## Export

### `GET /api/export/candidates`

**Auth required:** Yes (Supabase session cookie)  
**Purpose:** Exports all non-deleted candidates for the authenticated user's organization as a CSV file  
**File:** `app/api/export/candidates/route.ts`  
**Called by:** "Export CSV" button on the candidates page  

**Request params:** None  

**Response (200):** `Content-Type: text/csv` — file download `candidates.csv`  
Columns: First Name, Last Name, Email, Phone, Company, Position, Years Experience, Source, LinkedIn, Added  
Max rows: 10,000

**Response (401):** JSON `{ "error": "Unauthorized" }`

---

### `GET /api/export/applications?vacancy_id={id}`

**Auth required:** Yes (Supabase session cookie)  
**Purpose:** Exports all non-deleted applications for a specific vacancy as a CSV file  
**File:** `app/api/export/applications/route.ts`  
**Called by:** Export button on the vacancy applications tab  

**Query params:**
- `vacancy_id` (required) — UUID of the vacancy

**Response (200):** `Content-Type: text/csv` — file download `applications_{vacancy_title}.csv`  
Columns: First Name, Last Name, Email, Phone, LinkedIn, Application Status, Source, Applied At  
Max rows: 10,000

**Response (400):** `{ "error": "vacancy_id is required" }`  
**Response (401):** `{ "error": "Unauthorized" }`  
**Response (404):** `{ "error": "Vacancy not found" }`

---

## Google Calendar OAuth

### `GET /api/auth/google`

**Auth required:** Yes  
**Purpose:** Initiates Google Calendar OAuth. Generates CSRF state, sets cookie, redirects to Google  
**File:** `app/api/auth/google/route.ts`  
**Redirects to:** Google OAuth authorization URL or `/settings?google=not_configured` if env vars missing

---

### `GET /api/auth/google/callback`

**Auth required:** Yes  
**Purpose:** Handles Google OAuth callback — verifies state, exchanges code for tokens, stores in `profiles`  
**File:** `app/api/auth/google/callback/route.ts`  
**Query params:** `code`, `state`, `error`  
**Redirects to:** `/settings?google=connected` or `/settings?google=error` or `/settings?google=denied`

---

### `POST /api/auth/google/disconnect`

**Auth required:** Yes  
**Purpose:** Clears Google tokens from `profiles`  
**File:** `app/api/auth/google/disconnect/route.ts`  
**Redirects to:** `/settings?google=disconnected`

---

## Zoom OAuth

### `GET /api/auth/zoom`

**Auth required:** Yes  
**Purpose:** Initiates Zoom OAuth. Sets CSRF state cookie, redirects to Zoom  
**File:** `app/api/auth/zoom/route.ts`  
**Redirects to:** Zoom OAuth URL or `/settings?zoom=not_configured`

---

### `GET /api/auth/zoom/callback`

**Auth required:** Yes  
**Purpose:** Handles Zoom OAuth callback — verifies state, exchanges code for tokens, stores in `profiles`  
**File:** `app/api/auth/zoom/callback/route.ts`  
**Redirects to:** `/settings?zoom=connected` or `/settings?zoom=error`

---

### `POST /api/auth/zoom/disconnect`

**Auth required:** Yes  
**Purpose:** Clears Zoom tokens from `profiles`  
**File:** `app/api/auth/zoom/disconnect/route.ts`  
**Redirects to:** `/settings?zoom=disconnected`

---

## Microsoft OAuth

### `GET /api/auth/microsoft`

**Auth required:** Yes  
**Purpose:** Initiates Microsoft OAuth. Sets CSRF state cookie, redirects to Microsoft  
**File:** `app/api/auth/microsoft/route.ts`  
**Redirects to:** Microsoft OAuth URL or `/settings/integrations?microsoft=not_configured`

---

### `GET /api/auth/microsoft/callback`

**Auth required:** Yes  
**Purpose:** Handles Microsoft OAuth callback — verifies state, exchanges code for tokens, stores in `profiles`  
**File:** `app/api/auth/microsoft/callback/route.ts`  
**Redirects to:** `/settings/integrations?microsoft=connected` or `/settings/integrations?microsoft=error` or `/settings/integrations?microsoft=denied`

---

### `POST /api/auth/microsoft/disconnect`

**Auth required:** Yes  
**Purpose:** Clears Microsoft tokens from `profiles`  
**File:** `app/api/auth/microsoft/disconnect/route.ts`  
**Redirects to:** `/settings/integrations?microsoft=disconnected`

---

## CV Parsing 🆕

### `POST /api/parse-cv`

**Auth required:** No (public, IP rate-limited)
**Purpose:** Parses a CV (PDF / DOCX / DOC) into structured candidate data via Google Generative AI (Gemini 2.5/2.0 Flash). Used by both the internal "New Candidate" form and the public apply form.
**File:** `app/api/parse-cv/route.ts`
**Region:** Pinned to `fra1` (Frankfurt) — Vercel route segment config — to avoid Google's US‑region firewall blocks.
**Max duration:** 90 seconds

**Rate limit:** 10 requests per IP per hour, tracked in an **in-memory map** (resets on cold start — see issue `S-rate-limit-inmemory`).

**Request body:** `multipart/form-data`
- `file` (required) — File. Allowed MIME types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Max size 10 MB. Magic-byte validation enforced.

**Response (200):**
```json
{ "success": true, "parsed": { "firstName": "...", "lastName": "...", "email": "...", "phone": "...", "linkedinUrl": "...", "experience": [...], "education": [...], "skills": [...], "location": "..." } }
```
Schema enforced by `ParsedCVSchema` (`lib/validations/candidate-background.ts`).

**Errors:**
- `400` — `{ "success": false, "reason": "invalid_file" | "parse_failed" }`
- `422` — `{ "success": false, "reason": "<specific>" }` (validation rejected)
- `429` — `{ "success": false, "reason": "rate_limited" }`
- `504` — `{ "success": false, "reason": "timeout" }` (25s parse timeout exceeded)

---

## Integrations — LinkedIn 🆕

### `POST /api/integrations/linkedin/save`

**Auth required:** Yes (Supabase session, owner/admin)
**Purpose:** Stores a LinkedIn company-page ID for the caller's organization so the "Share to LinkedIn" button has a target.
**File:** `app/api/integrations/linkedin/save/route.ts`
**Side effect:** Upserts `organization_integrations` row with `platform = 'linkedin'`.

**Request body:** `application/x-www-form-urlencoded`
- `page_id` — numeric LinkedIn company page ID OR full URL (e.g. `https://www.linkedin.com/company/12345/`). Numeric ID extracted from URL.

**Redirects:**
- Success → `/settings/integrations?linkedin=connected`
- Invalid page id → `/settings/integrations?linkedin=invalid_page_id`
- DB failure → `/settings/integrations?linkedin=error`

> ⚠️ Note: `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` exist in `lib/env.ts` but are **not used** by this endpoint — there is no LinkedIn OAuth flow today; the integration is manual page-ID entry. See open issue `C-unused-env-vars`.

---

### `POST /api/integrations/linkedin/disconnect`

**Auth required:** Yes (Supabase session, owner/admin)
**Purpose:** Removes the LinkedIn integration row for the caller's organization.
**File:** `app/api/integrations/linkedin/disconnect/route.ts`
**Redirects to:** `/settings/integrations?linkedin=disconnected`

---

## Auth Routes (Non-API)

### `GET /auth/confirm`

**Auth required:** No  
**Purpose:** Verifies a `token_hash` OTP and redirects to `next`  
**File:** `app/auth/confirm/route.ts`  
**Query params:** `token_hash`, `type` (e.g. `signup`, `recovery`), `next` (optional, defaults to `/dashboard`)  
**Redirects to:** `next` on success, `/auth/error` on failure

---

### `GET /auth/callback`

**Auth required:** No  
**Purpose:** Exchanges OAuth PKCE `code` for session (used by Supabase OAuth sign-in providers)  
**File:** `app/auth/callback/route.ts`  
**Query params:** `code`, `next` (optional)  
**Redirects to:** `next` (relative paths only) on success, `/auth/error` on failure
