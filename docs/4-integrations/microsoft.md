# Microsoft Integration

_Last updated: 2026-05-08_

## Changelog

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

To disconnect: `POST /api/auth/microsoft/disconnect` clears the three token columns.

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

## Important Notes

- The tenant is `common` — allows any Microsoft account to authenticate
- The `azure` provider for Supabase sign-in and the custom Microsoft integration OAuth are separate apps/flows
- The sign-in provider requires only `email` scope; the integration requires `Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access`
