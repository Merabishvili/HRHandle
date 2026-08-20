# Zoom Integration

_Last updated: 2026-08-20_

## Changelog

- 🆕 2026-08-20 — documented the **redirect-URI registration** on the Zoom Marketplace app (fixes `Invalid redirect … (4,700)`). No code change; the redirect URI was always correct — it just wasn't in the app's OAuth allow list.
- 🔄 No code changes. Note: there is still no Zoom-meeting deletion when an interview is cancelled (Google Calendar **does** delete events) — tracked as `BL-zoom-cleanup`.

---

## Overview

Zoom OAuth allows team members to create Zoom meetings directly from the interview scheduling flow. Tokens are stored per-user in the `profiles` table.

## OAuth Flow

1. User visits `Settings → Integrations` and clicks "Connect Zoom"
2. `GET /api/auth/zoom` generates a CSRF state token, stores in cookie (`zoom_oauth_state`, 10 min TTL), redirects to `https://zoom.us/oauth/authorize`
3. User consents on Zoom
4. Zoom redirects to `GET /api/auth/zoom/callback` with `code` and `state`
5. State cookie verified
6. `exchangeZoomCode(code)` exchanges for `access_token`, `refresh_token`, `expires_in` — uses Basic auth header (`client_id:client_secret` base64)
7. Tokens stored in `profiles` via admin client:
   - `zoom_access_token`
   - `zoom_refresh_token`
   - `zoom_token_expiry` (Unix ms)
8. Redirect to `/settings?zoom=connected`

To disconnect: `POST /api/auth/zoom/disconnect` calls Zoom's OAuth revoke endpoint (`https://zoom.us/oauth/revoke`, Basic-auth with the client credentials) on the stored access token (best-effort — if the revoke fails for any reason the route still clears the local tokens), then clears the three token columns. Tracked as G-006.

## Token Refresh

`getValidZoomAccessToken(userId)` in `lib/zoom/meetings.ts`:
1. Reads `zoom_access_token`, `zoom_refresh_token`, `zoom_token_expiry` from `profiles`
2. If token is still valid (with 60-second buffer), returns it directly
3. Otherwise calls `refreshZoomToken()` using `refresh_token` grant with Basic auth
4. Updates `zoom_access_token` and `zoom_token_expiry` in database
5. Returns fresh token

## Creating Zoom Meetings

`createZoomMeeting(accessToken, { topic, startIso, durationMinutes })`

- Calls `POST https://api.zoom.us/v2/users/me/meetings`
- Meeting type `2` (scheduled)
- Settings: `join_before_host: true`, `waiting_room: false`
- Returns `{ joinUrl: string, meetingId: string }` or `null` on failure
- `joinUrl` is stored in `interviews.meeting_link`

Note: No meeting deletion when an interview is cancelled (unlike Google Calendar). The Zoom meeting remains active.

## When Zoom Meeting Is Created

In `createInterview()` (`lib/actions/interviews.ts`) when `options.createZoom === true` and `type === 'video'`:
1. Calls `getValidZoomAccessToken(ctx.userId)`
2. If token available, fetches vacancy title
3. Creates meeting with topic `Interview: {firstName} {lastName} — {vacancyTitle}`
4. Updates `interviews.meeting_link` with `joinUrl`

## Token Storage in Database

Stored in `profiles` table:
- `zoom_access_token`
- `zoom_refresh_token`
- `zoom_token_expiry` (bigint, Unix milliseconds)

## Files

- `lib/zoom/meetings.ts` — `getZoomOAuthUrl`, `getZoomRedirectUri`, `exchangeZoomCode`, `getValidZoomAccessToken`, `createZoomMeeting`
- `app/api/auth/zoom/route.ts` — initiates OAuth
- `app/api/auth/zoom/callback/route.ts` — handles callback, stores tokens
- `app/api/auth/zoom/disconnect/route.ts` — clears tokens
- `components/settings/zoom-connect.tsx` — UI for connect/disconnect

## Environment Variables

| Variable | Purpose |
|---|---|
| `ZOOM_CLIENT_ID` | Zoom OAuth app client ID (optional — feature disabled if missing) |
| `ZOOM_CLIENT_SECRET` | Zoom OAuth app client secret (optional — feature disabled if missing) |

If either is missing, `GET /api/auth/zoom` redirects to `/settings?zoom=not_configured`.

## Redirect URIs — Zoom Marketplace (fixes `Invalid redirect … (4,700)`)

The redirect URI the app sends is built from `NEXT_PUBLIC_SITE_URL`:
`${NEXT_PUBLIC_SITE_URL}/api/auth/zoom/callback` (see `getZoomRedirectUri` in
`lib/zoom/meetings.ts`). Zoom validates it against the app's allow list at the
authorize step and returns **error 4700 `Invalid redirect: …`** on any URI that
isn't registered **exactly** (scheme + host + path, no trailing slash).

**Register all three** on the Zoom app (Zoom Marketplace → your app → **OAuth
Information**): set **Redirect URL for OAuth** to the production URI and add every
environment to the **OAuth Allow List**:

- `https://hrhandle.com/api/auth/zoom/callback` — production
- `https://staging.hrhandle.com/api/auth/zoom/callback` — staging
- `http://localhost:3000/api/auth/zoom/callback` — local dev

Notes:
- Use the **exact** host `NEXT_PUBLIC_SITE_URL` resolves to. Prod is the apex
  `hrhandle.com` (not `www`); if that env var is ever changed to `www.hrhandle.com`,
  the registered URI must change with it. (Same apex/www gotcha as Google/Turnstile.)
- This mirrors the Google/Microsoft redirect-URI registration — see
  `docs/4-integrations/google.md`. Changes can take a few minutes to propagate.
