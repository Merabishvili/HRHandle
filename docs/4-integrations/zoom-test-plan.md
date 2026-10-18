# HRHandle for Zoom — Test Plan

_For the Zoom Marketplace review team. Last updated: 2026-10-18._

## About the app

HRHandle (https://hrhandle.com) is an applicant tracking system. The Zoom app creates a scheduled Zoom meeting on the user's own Zoom account for each video interview the user schedules in HRHandle, and deletes it when the interview is cancelled. End-user documentation: https://hrhandle.com/guide/zoom · Support: https://hrhandle.com/support

## Scopes and where each is tested

| Scope | Used for | Test step |
|---|---|---|
| `user:read:user` | Read the authorizing user's Zoom ID (`GET /v2/users/me`) to map a deauthorization event to their HRHandle profile | 1 |
| `meeting:write:meeting` | Create a scheduled meeting (`POST /v2/users/me/meetings`) | 2 |
| `meeting:delete:meeting` | Delete that meeting when the interview is cancelled (`DELETE /v2/meetings/{id}`) | 4 |

There are no optional scopes.

## Test credentials (HRHandle, not Zoom)

Both accounts are in the same HRHandle organization, on an active paid plan, with MFA turned off and with sample data: the vacancy **"Zoom Review — Sales Manager"** and the candidates **"Test Candidate One"** and **"Test Candidate Two"**.

| Role | Email | Password |
|---|---|---|
| Admin (user A) | `<to fill>` | `<to fill>` |
| Member (user B) | `<to fill>` | `<to fill>` |

Sign in at https://hrhandle.com/auth/login with email and password. The app authorizes with the **Production** Client ID. Use two different Zoom test users for A and B.

## Steps

**1. Authorize (user A)**
1. Sign in to HRHandle as user A.
2. Open **Settings → Integrations** (left sidebar → Settings → Integrations tab).
3. Next to Zoom, click **Connect Zoom**.
4. Sign in to Zoom with Zoom test user A and click **Allow**.

Expected: you return to Settings → Integrations with "Zoom connected successfully." and Zoom shows as connected.

**2. Create a meeting (user A)**
1. Open **Interviews** and click **Schedule interview**.
2. Candidate: **Test Candidate One**; vacancy: **Zoom Review — Sales Manager**.
3. Interview type: **Video**. Date: tomorrow. Time: 11:00. Duration: 30 min. Interviewer: user A.
4. Meeting: choose **Auto Zoom**. Leave **Email candidate** unticked (the candidate address is a dummy).
5. Click **Schedule**.

Expected: the interview appears on the Interviews page with a `https://…zoom.us/j/…` link. In Zoom test user A's account (zoom.us → Meetings) a meeting "Interview: Test Candidate One — Zoom Review — Sales Manager" exists at that time.

**3. Join (user A)**
1. On the Interviews page click **Join** on that interview.

Expected: the Zoom meeting opens.

**4. Cancel → meeting deleted (user A)**
1. On the Interviews page click **⋯** next to the interview → **Cancel interview** → confirm.

Expected: the interview shows as Cancelled, and the meeting is gone from Zoom test user A's Meetings list.

**5. Second user (user B)**
1. Sign in to HRHandle as user B (use a private window).
2. Repeat step 1 with Zoom test user B, then step 2 with **Test Candidate Two**.

Expected: the meeting is created on Zoom test user B's account, not user A's. Each HRHandle user's Zoom connection is personal.

**6. Disconnect from HRHandle (user A)**
1. As user A open **Settings → Integrations** and click **Disconnect** next to Zoom.

Expected: Zoom shows as not connected. HRHandle revokes its token, so HRHandle no longer appears under marketplace.zoom.us → **Manage → Added Apps** for Zoom test user A. Auto Zoom is no longer offered when scheduling.

**7. Remove from Zoom (user B)**
1. As Zoom test user B open https://marketplace.zoom.us → **Manage → Added Apps** → HRHandle → **Remove**.
2. In HRHandle as user B, reload **Settings → Integrations**.

Expected: Zoom shows as not connected. HRHandle received the deauthorization notification, deleted user B's Zoom tokens and Zoom user ID, and called the data compliance API.

## Notes

- Paid-tier gate: none for Zoom; the test organization is on an active plan so no trial lock interferes.
- 2FA: off on both test accounts. (If enabled on a real account, sign-in asks for an authenticator code; it does not affect the Zoom flow.)
