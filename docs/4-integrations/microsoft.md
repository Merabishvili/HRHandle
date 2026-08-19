# Microsoft Integration

_Last updated: 2026-07-03_

## Changelog

- 2026-07-03 — **Diagnosable connect failures.** The callback previously collapsed every post-consent failure into a single generic `microsoft=error` ("Failed to connect Microsoft account"), so the real cause was invisible. It now mirrors the Google flow: `exchangeMicrosoftCode`/`refreshMicrosoftToken` log the Azure response body (AADSTS code), and the callback returns distinct statuses — `microsoft=denied` (user cancelled / OAuth error, with `error_description` logged), `microsoft=state_mismatch` (CSRF cookie missing/stale), `microsoft=token_exchange_failed` (Azure rejected the code exchange). See **Troubleshooting** below.
- 🔄 No flow changes. Note: Microsoft redirects use `/settings/integrations?microsoft=*` while Google & Zoom use `/settings?google=*` / `/settings?zoom=*` — the inconsistency is tracked as `BL-microsoft-redirect` in `docs/issues-found.md`.

---

## Overview

Microsoft integration serves two purposes:
1. **Microsoft/Azure OAuth for sign-in** — handled by Supabase's built-in Azure provider (provider name `azure`)
2. **Microsoft Graph API for creating Teams online meetings via Calendar events** — custom OAuth flow in `lib/microsoft/graph.ts`

## Microsoft Sign-in (Supabase OAuth)

Configured as the `azure` provider in Supabase dashboard with scope `email`. The login page calls:

```ts
supabase.auth.signInWithOAuth({ provider: 'azure', options: { redirectTo: callbackUrl, scopes: 'email' } })
```

No tokens are stored in the `profiles` table for sign-in.

### First-time sign-up flow

Microsoft does not return a company name in `user_metadata`. First-time OAuth users (no `organization_id` AND no `user_metadata.company_name`) are redirected by the dashboard layout to `/onboarding/company` to collect name + company name before `runOnboarding` creates the org. See `docs/4-integrations/google.md` for the same flow on Google's side.

## Microsoft Graph / Teams Meeting Integration

A separate OAuth flow that allows creating Teams meetings via Microsoft Calendar events.

### OAuth Scopes

```
Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access
```

### OAuth Flow

1. User visits `Settings → Integrations` and clicks "Connect Microsoft"
2. `GET /api/auth/microsoft` generates CSRF state, stores in cookie (`microsoft_oauth_state`, 10 min TTL), redirects to `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
3. Uses `response_mode: query` (not fragment)
4. User consents on Microsoft
5. Redirects to `GET /api/auth/microsoft/callback` with `code` and `state`
6. State cookie verified
7. `exchangeMicrosoftCode(code)` POSTs to `https://login.microsoftonline.com/common/oauth2/v2.0/token`
8. Tokens stored in `profiles` via admin client:
   - `microsoft_access_token`
   - `microsoft_refresh_token`
   - `microsoft_token_expiry` (Unix ms)
9. Redirect to `/settings/integrations?microsoft=connected`

To disconnect: `POST /api/auth/microsoft/disconnect` clears the three token columns. **Unlike Google and Zoom, no upstream revoke call is made**: Microsoft Entra has no documented programmatic OAuth 2.0 revoke endpoint for refresh tokens (the `end_session_endpoint` performs a global sign-out across every Microsoft app, which is too aggressive for a per-integration disconnect). The dangling refresh token in Entra expires on Microsoft's own schedule (typically 90 days of inactivity). Users wanting absolute revocation can remove HRHandle from their authorised apps at https://myaccount.microsoft.com/. See the in-file comment in `app/api/auth/microsoft/disconnect/route.ts`. Tracked as G-006.

### Token Refresh

`getValidMicrosoftAccessToken(userId)` in `lib/microsoft/graph.ts`:
1. Reads `microsoft_access_token`, `microsoft_refresh_token`, `microsoft_token_expiry` from `profiles`
2. If token valid (60-second buffer), returns current token
3. Otherwise calls `refreshMicrosoftToken()` using `refresh_token` grant
4. Updates `microsoft_access_token` and `microsoft_token_expiry` in database
5. Returns fresh token

### Creating Teams Meetings

`createTeamsMeeting(accessToken, { summary, description, startIso, endIso, attendeeEmails })`

- Calls `POST https://graph.microsoft.com/v1.0/me/events`
- Sets `isOnlineMeeting: true`, `onlineMeetingProvider: 'teamsForBusiness'`
- Adds attendees as `required` type with their email addresses
- Returns `{ teamsLink: string | null, eventId: string | null }`
- `teamsLink` extracted from `data.onlineMeeting.joinUrl`
- `eventId` stored in `interviews.microsoft_calendar_event_id`

`deleteMicrosoftEvent(accessToken, eventId)` calls `DELETE https://graph.microsoft.com/v1.0/me/events/{eventId}`.

### When Teams Meeting Is Created

In `createInterview()` when `options.createTeams === true` and `type === 'video'`:
1. Calls `getValidMicrosoftAccessToken(ctx.userId)`
2. Fetches vacancy title and interviewer email
3. Calls `createTeamsMeeting()` with candidate + interviewer as attendees
4. Updates `interviews.meeting_link` and `interviews.microsoft_calendar_event_id`

## Token Storage in Database

Stored in `profiles` table:
- `microsoft_access_token`
- `microsoft_refresh_token`
- `microsoft_token_expiry` (bigint, Unix milliseconds)

## Files

- `lib/microsoft/graph.ts` — `getMicrosoftOAuthUrl`, `getMicrosoftRedirectUri`, `exchangeMicrosoftCode`, `getValidMicrosoftAccessToken`, `createTeamsMeeting`, `deleteMicrosoftEvent`
- `app/api/auth/microsoft/route.ts` — initiates OAuth
- `app/api/auth/microsoft/callback/route.ts` — handles callback, stores tokens
- `app/api/auth/microsoft/disconnect/route.ts` — clears tokens
- `components/settings/microsoft-connect.tsx` — UI for connect/disconnect

## Environment Variables

| Variable | Purpose |
|---|---|
| `MICROSOFT_CLIENT_ID` | Azure AD app client ID (optional — feature disabled if missing) |
| `MICROSOFT_CLIENT_SECRET` | Azure AD app client secret (optional — feature disabled if missing) |

If either is missing, `GET /api/auth/microsoft` redirects to `/settings/integrations?microsoft=not_configured`.

## Troubleshooting

The connect flow returns a `microsoft=<status>` query param that the UI turns into a message. Match the status to the cause:

| Status | Meaning | Where to look |
|---|---|---|
| `not_configured` | `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` unset on the server | Vercel env vars for the affected environment |
| `denied` | User cancelled, or Microsoft returned an OAuth error at consent | Server log line `[microsoft/callback] denied or missing params` — includes `error` + `error_description` (e.g. `consent_required`, `access_denied`) |
| `state_mismatch` | CSRF state cookie missing/stale — user took >10 min, or the browser blocked the cookie | Usually transient; retrying fixes it |
| `token_exchange_failed` | Microsoft rejected the `authorization_code` exchange | Server log line `[microsoft/graph] exchangeMicrosoftCode failed: <status> …` — includes the **AADSTS** code from Azure |

**`token_exchange_failed` is almost always an Azure-side config problem** (the app reached our callback with a valid code, so the credentials/redirect worked at the authorize step but not at the token step). Check, in order:

1. **Client secret** — the most common cause. Azure app secrets **expire** (often 6–24 months). Confirm `MICROSOFT_CLIENT_SECRET` on Vercel holds the secret **Value** (not the secret **ID**) and hasn't expired. Regenerate under _Azure Portal → App registrations → your app → Certificates & secrets_ and update **both** staging and production Vercel envs. AADSTS7000215 = invalid secret.
2. **Redirect URI registered** — under _Authentication → Web → Redirect URIs_, both must be present:
   - `https://staging.hrhandle.com/api/auth/microsoft/callback`
   - `https://hrhandle.com/api/auth/microsoft/callback`
   - (`http://localhost:3000/api/auth/microsoft/callback` for local dev)
   AADSTS9002313 / `redirect_uri` mismatch = missing/typo'd URI.
3. **Admin consent** — `Calendars.ReadWrite` / `OnlineMeetings.ReadWrite` on a tenant that requires admin consent will fail for non-admin users. Grant admin consent for the app, or have a tenant admin approve.

The Azure app for this integration is **separate** from the Supabase `azure` sign-in provider — changing one does not affect the other.

## Important Notes

- The tenant is `common` — allows any Microsoft account to authenticate
- The `azure` provider for Supabase sign-in and the custom Microsoft integration OAuth are separate apps/flows
- The sign-in provider requires only `email` scope; the integration requires `Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access`

## Post-signup connect prompt

Because Microsoft sign-in only grants `email` and doesn't capture Teams/Outlook tokens, the integration is **not** auto-linked. Users who signed up with Microsoft (`azure`) see a dismissible "Connect Microsoft Teams" banner on the dashboard, linking to the same `/api/auth/microsoft` flow used in Settings → Integrations. Shared with Google — see [google.md](./google.md#post-signup-connect-prompt); logic in [`lib/integrations/prompt.ts`](../../lib/integrations/prompt.ts).
