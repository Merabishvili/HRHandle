# Zoom Integration

_Last updated: 2026-10-18_

## Changelog

- 🆕 2026-10-18 — **Marketplace review fixes** (functional review returned 2026-08-25 with 7 notes): public end-user docs at **`/guide/zoom`** (EN/KA/RU: add, use, remove, data, troubleshooting) = the app's **Documentation URL**; `/support` now lists hours, first-response time and channels = the **Support URL**; reviewer test plan in `docs/4-integrations/zoom-test-plan.md`; Dev/Prod credentials split documented below. Corrected the stale note below: cancelling an interview **does** delete the Zoom meeting (since 2026-05-23, BL-010), which needs the `meeting:delete:meeting` scope.
- 🆕 2026-08-20 — **deauthorization webhook** for Marketplace publishing: `POST /api/webhooks/zoom/deauthorization` (CRC + signature + data-compliance), `profiles.zoom_user_id` mapping (migration `20260820_zoom_user_id.sql`), `ZOOM_SECRET_TOKEN` env var. Plus a publishing checklist.
- 🆕 2026-08-20 — documented the **redirect-URI registration** on the Zoom Marketplace app (fixes `Invalid redirect … (4,700)`). No code change; the redirect URI was always correct — it just wasn't in the app's OAuth allow list.
- 🔄 No code changes. ~~Note: there is still no Zoom-meeting deletion when an interview is cancelled~~ — outdated: fixed 2026-05-23 (BL-010), see *Deleting Zoom meetings*.

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

## Deleting Zoom meetings

When an interview is cancelled, `updateInterviewStatus(_, 'cancelled')` (`lib/actions/interviews.ts`) recovers the meeting ID from the stored join URL (`parseZoomMeetingIdFromJoinUrl`) and calls `deleteZoomMeeting` (`DELETE /v2/meetings/{id}`, best-effort; 404 counts as success). Requires the `meeting:delete:meeting` scope.

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

- `lib/zoom/meetings.ts` — `getZoomOAuthUrl`, `getZoomRedirectUri`, `exchangeZoomCode`, `getValidZoomAccessToken`, `createZoomMeeting`, `fetchZoomUserId`, `notifyZoomDataCompliance`
- `lib/zoom/webhook.ts` — `zoomCrcEncryptedToken`, `verifyZoomSignature` (deauthorization webhook crypto)
- `app/api/auth/zoom/route.ts` — initiates OAuth
- `app/api/auth/zoom/callback/route.ts` — handles callback, stores tokens + `zoom_user_id`
- `app/api/auth/zoom/disconnect/route.ts` — clears tokens
- `app/api/webhooks/zoom/deauthorization/route.ts` — Zoom uninstall webhook (CRC + signature + data compliance)
- `components/settings/zoom-connect.tsx` — UI for connect/disconnect

## Environment Variables

| Variable | Purpose |
|---|---|
| `ZOOM_CLIENT_ID` | Zoom OAuth app client ID (optional — feature disabled if missing) |
| `ZOOM_CLIENT_SECRET` | Zoom OAuth app client secret (optional — feature disabled if missing) |
| `ZOOM_SECRET_TOKEN` | Zoom app **Secret Token** — verifies the deauthorization webhook's signature + URL-validation (CRC) challenge. Set on **both** Vercel envs. |

If either client credential is missing, `GET /api/auth/zoom` redirects to `/settings?zoom=not_configured`.

## Deauthorization webhook (required for Marketplace publishing)

Zoom's **Security Review** requires the app to delete a user's data when they
uninstall it. Implemented at **`POST /api/webhooks/zoom/deauthorization`**
(`app/api/webhooks/zoom/deauthorization/route.ts`):

1. **URL validation (CRC):** answers Zoom's `endpoint.url_validation` event with
   `{ plainToken, encryptedToken }`, where `encryptedToken = HMAC-SHA256(plainToken, ZOOM_SECRET_TOKEN)` (see `lib/zoom/webhook.ts`).
2. **Signature check:** every other event must carry a valid `x-zm-signature`
   (`v0=HMAC-SHA256("v0:<timestamp>:<rawBody>", ZOOM_SECRET_TOKEN)`), else 401.
3. **`app_deauthorized`:** clears the user's `zoom_*` columns (matched by
   `zoom_user_id`) and calls Zoom's data-compliance API
   (`POST /oauth/data/compliance`, `notifyZoomDataCompliance` in `lib/zoom/meetings.ts`).

To make the mapping possible, the OAuth **callback** stores the connected user's
Zoom id in `profiles.zoom_user_id` (best-effort; migration
`20260820_zoom_user_id.sql`, apply on both projects).

Set the endpoint in the Zoom app under **Basic Information → Deauthorization
Notification → Endpoint URL**: `https://hrhandle.com/api/webhooks/zoom/deauthorization`.

## Publishing checklist (Zoom Marketplace)

- **Scopes:** three, all minimal:
  - `meeting:write:meeting` — create a meeting for the authorized user (`POST /v2/users/me/meetings`).
  - `meeting:delete:meeting` — delete that meeting when the interview is cancelled (`DELETE /v2/meetings/{id}`). Without it the cancel cleanup fails silently and Zoom's reviewers see an API call outside the declared scopes.
  - `user:read:user` — read the connected user's own id (`GET /v2/users/me`) so a deauthorization event can be mapped back to their profile (`zoom_user_id`) and their data deleted.
- **OAuth Redirect URL — separate per tab** (reviewer asked for it; no localhost on either):
  - **Development** tab → `https://staging.hrhandle.com/api/auth/zoom/callback`; its client ID/secret are the **Preview** (staging) Vercel `ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET`.
  - **Production** tab → `https://hrhandle.com/api/auth/zoom/callback`; its client ID/secret are the **Production** Vercel vars. Reviewers refuse to test if production authorizes with the Development client ID.
- **Documentation URL:** `https://hrhandle.com/guide/zoom` (content in `content/guides/{en,ka,ru}/zoom.mdx`). Keep it in sync with scopes and the remove flow.
- **Support URL:** `https://hrhandle.com/support` — must show hours, first-response time and channels (`support.help.*` messages).
- **Developer contact:** a person's name + a company-domain email (`support@hrhandle.com`), not Gmail.
- **Zoom account:** "Free with Credit Card" (a plain free account blocks review).
- **Test credentials + test plan:** two HRHandle accounts (admin + member, one org, active plan, sample data, MFA off) and the plan in `zoom-test-plan.md`, published as a shared doc and linked in **Release Notes** on every (re)submission.
- **Deauthorization endpoint:** the webhook above + `ZOOM_SECRET_TOKEN` set on Vercel.
- **App Listing:** name, short/long description, icon, screenshots, **Privacy Policy** `https://hrhandle.com/privacy`, **Terms** `https://hrhandle.com/terms`, support contact.
- **Dev vs Prod:** an **unpublished** app only authorizes the owner + test users; real customers can connect only **after** the app passes Functional + Security review and is published.

## Redirect URIs — Zoom Marketplace (fixes `Invalid redirect … (4,700)`)

The redirect URI the app sends is built from `NEXT_PUBLIC_SITE_URL`:
`${NEXT_PUBLIC_SITE_URL}/api/auth/zoom/callback` (see `getZoomRedirectUri` in
`lib/zoom/meetings.ts`). Zoom validates it against the app's allow list at the
authorize step and returns **error 4700 `Invalid redirect: …`** on any URI that
isn't registered **exactly** (scheme + host + path, no trailing slash).

Register each environment on its own tab (Zoom Marketplace → your app →
**OAuth Information**). Staging authorizes with the Development credentials,
production with the Production ones. Local dev uses the Development credentials
too and needs `http://localhost:3000/...` on the Development allow list only while
you test locally — Zoom's reviewers ask that submitted URLs are not localhost:

- `https://hrhandle.com/api/auth/zoom/callback` — production
- `https://staging.hrhandle.com/api/auth/zoom/callback` — staging
- `http://localhost:3000/api/auth/zoom/callback` — local dev

Notes:
- Use the **exact** host `NEXT_PUBLIC_SITE_URL` resolves to. Prod is the apex
  `hrhandle.com` (not `www`); if that env var is ever changed to `www.hrhandle.com`,
  the registered URI must change with it. (Same apex/www gotcha as Google/Turnstile.)
- This mirrors the Google/Microsoft redirect-URI registration — see
  `docs/4-integrations/google.md`. Changes can take a few minutes to propagate.
