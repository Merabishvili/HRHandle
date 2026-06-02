# Google Integration

_Last updated: 2026-05-08_

## Changelog

- 🔄 No structural changes to Google OAuth / Calendar flows since previous audit
- 🆕 A separate Google service — **Generative AI (Gemini)** — is now used for CV parsing. See [`google-generative-ai.md`](google-generative-ai.md). It uses a different env var (`GOOGLE_GEMINI_API_KEY`) and is not part of OAuth.

---

## Overview

The Google integration has two separate uses:
1. **Google OAuth for sign-in** — handled entirely by Supabase's built-in OAuth provider (no custom code)
2. **Google Calendar API for creating calendar events and Google Meet links** — custom OAuth flow in `lib/google/calendar.ts`

## Google Sign-in (Supabase OAuth)

Configured as a provider in Supabase dashboard. The login page calls:

```ts
supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl } })
```

The callback is `app/auth/callback/route.ts` which exchanges the PKCE code for a session. No tokens are stored in the `profiles` table for this flow.

### First-time sign-up flow

Google does not return a company name in `user_metadata`. To avoid auto-creating an org called "New Organization", the dashboard layout intercepts first-time OAuth users (no `organization_id` AND no `user_metadata.company_name`) and redirects them to `/onboarding/company` to collect name + company name before `runOnboarding` runs. See `app/onboarding/company/page.tsx` and `lib/actions/onboarding.ts:completeCompanyOnboarding`. Returning OAuth users have an `organization_id` already and skip the page entirely.

### Supabase Provider Settings (production — `fnpyfwhvgzoxgyjafbsg`)

| Setting | Value |
|---|---|
| Enable Sign in with Google | ON |
| Skip nonce checks | OFF |
| Allow users without an email | OFF |
| Callback URL (for OAuth) | `https://fnpyfwhvgzoxgyjafbsg.supabase.co/auth/v1/callback` |

The Client ID and Client Secret are the same credentials used for the Google Calendar integration (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`). The Callback URL shown in the Supabase dashboard is the URI to register in Google Cloud Console — it is already registered there.

> **Root cause of past sign-in bug (2026-05-08):** `https://hrhandle.com/auth/callback` was missing from Supabase's allowed redirect URLs (Authentication → URL Configuration). Supabase fell back to the Site URL, sending the `?code=` to `hrhandle.com/` instead of `/auth/callback`. Fixed by adding the URL to the allowlist.

## Google Calendar Integration

A separate OAuth flow that allows the app to create Google Calendar events with Google Meet links on behalf of the authenticated user.

### Flow

1. User visits `Settings → Integrations` and clicks "Connect Google Calendar"
2. `GET /api/auth/google` generates a CSRF state token, stores it in a cookie (`google_oauth_state`, 10 min TTL), and redirects to `accounts.google.com/o/oauth2/v2/auth`
3. OAuth scopes requested:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/userinfo.email`
4. After consent, Google redirects to `GET /api/auth/google/callback` with `code` and `state`
5. State cookie is verified (CSRF protection)
6. `exchangeCodeForTokens(code)` exchanges for `access_token`, `refresh_token`, `expires_in`
7. Tokens stored in `profiles` table via admin client:
   - `google_access_token`
   - `google_refresh_token`
   - `google_token_expiry` (Unix ms)
8. Redirect to `/settings?google=connected`

To disconnect: `POST /api/auth/google/disconnect` calls Google's OAuth revoke endpoint (`https://oauth2.googleapis.com/revoke`) on the stored refresh token (best-effort — if the revoke fails for any reason the route still clears the local tokens), then clears the three token columns. Tracked as G-006.

### Token Refresh

`getValidAccessToken(userId)` in `lib/google/calendar.ts`:
1. Loads token columns from `profiles` via admin client
2. If `google_token_expiry` is in the future (with 60-second buffer) and token exists, returns existing token
3. Otherwise calls `refreshAccessToken(refreshToken)` using `refresh_token` grant
4. Updates `google_access_token` and `google_token_expiry` in database
5. Returns fresh access token

### Creating Calendar Events with Google Meet

`createCalendarEventWithMeet(accessToken, { requestId, summary, description, startIso, endIso, attendeeEmails })`

- Calls `POST https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`
- Requests `conferenceSolutionKey.type: 'hangoutsMeet'` to generate a Meet link
- Returns `{ meetLink: string | null, eventId: string | null }`
- `meetLink` is extracted from `conferenceData.entryPoints[type=video].uri`
- `eventId` is stored in `interviews.google_calendar_event_id` for later deletion

`deleteCalendarEvent(accessToken, eventId)` calls `DELETE /calendar/v3/calendars/primary/events/{eventId}`.

### When Meet Is Created

In `createInterview()` (`lib/actions/interviews.ts`) when `options.createMeet === true` and `type === 'video'`:
1. Calls `getValidAccessToken(ctx.userId)`
2. If token available, fetches vacancy title and interviewer email
3. Calls `createCalendarEventWithMeet()` with candidate + interviewer as attendees
4. Updates `interviews.google_meet_link` and `interviews.google_calendar_event_id`

## Token Storage

Stored in `profiles` table (see database schema):
- `google_access_token` — current access token
- `google_refresh_token` — long-lived refresh token
- `google_token_expiry` — bigint, Unix milliseconds timestamp of access token expiry

## Files

- `lib/google/calendar.ts` — `getGoogleOAuthUrl`, `getRedirectUri`, `exchangeCodeForTokens`, `getValidAccessToken`, `createCalendarEventWithMeet`, `deleteCalendarEvent`
- `app/api/auth/google/route.ts` — initiates OAuth
- `app/api/auth/google/callback/route.ts` — handles callback, stores tokens
- `app/api/auth/google/disconnect/route.ts` — clears tokens
- `components/settings/google-calendar-connect.tsx` — UI for connect/disconnect

## Environment Variables

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID (optional — feature disabled if missing) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret (optional — feature disabled if missing) |

If either is missing, `GET /api/auth/google` redirects to `/settings?google=not_configured` instead of initiating OAuth.

## Google Cloud OAuth Configuration

One shared Google OAuth client is used for **both environments (staging + production)** and for **both sign-in and calendar integration**. All redirect URIs for all environments are registered on this single client.

### Authorized Redirect URIs (Google Cloud Console)

```
https://staging.hrhandle.com/
https://staging.hrhandle.com/api/auth/google/callback
https://quotchdymcnjlnwtjmgu.supabase.co/auth/v1/callback
http://localhost:3000/api/auth/google/callback
https://hrhandle.com/auth/callback
https://hrhandle.com/api/auth/google/callback
https://fnpyfwhvgzoxgyjafbsg.supabase.co/auth/v1/callback
https://hrhandle.com/auth/login
https://staging.hrhandle.com/auth/login
```

**What each URI is for:**
| URI | Purpose |
|---|---|
| `https://quotchdymcnjlnwtjmgu.supabase.co/auth/v1/callback` | Supabase sign-in callback — staging |
| `https://fnpyfwhvgzoxgyjafbsg.supabase.co/auth/v1/callback` | Supabase sign-in callback — production |
| `https://staging.hrhandle.com/api/auth/google/callback` | Calendar integration — staging |
| `https://hrhandle.com/api/auth/google/callback` | Calendar integration — production |
| `http://localhost:3000/api/auth/google/callback` | Calendar integration — local dev |
| `https://hrhandle.com/auth/callback` | Supabase sign-in fallback — production |
| `https://hrhandle.com/auth/login` | Auth page |
| `https://staging.hrhandle.com/auth/login` | Auth page — staging |
| `https://staging.hrhandle.com/` | Staging home (likely legacy) |

> **If Google OAuth breaks with `redirect_uri_mismatch`:** The missing URI needs to be added to this single shared OAuth client in Google Cloud Console. Changes can take 5–10 minutes to propagate.
