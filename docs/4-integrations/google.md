# Google Integration

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

To disconnect: `POST /api/auth/google/disconnect` clears the three token columns.

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
