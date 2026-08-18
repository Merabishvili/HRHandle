# Phase 5 — Manual deployment steps

You ship the code; this doc tells you the click-through work that has to happen alongside it. Everything below is a one-time setup per environment unless noted.

Two integrations land in this phase:

1. **Slack + Teams webhook notifications (G-030)** — no external account registration needed from you. Customers (org admins) generate their own webhook URLs inside their Slack workspace or Teams channel and paste them into HRHandle. There's nothing to register; you just apply migration 040.
2. **Calendly (G-031)** — needs you to register a Calendly OAuth app once per environment + add two env vars to Vercel.

---

## 1. Apply database migrations

Run BOTH of these in Supabase → SQL Editor on EACH project (staging and production).

| Migration | File | Staging project | Production project |
|---|---|---|---|
| 040 webhook notifications | `scripts/040_webhook_notifications.sql` | `quotchdymcnjlnwtjmgu` | `fnpyfwhvgzoxgyjafbsg` |
| 041 calendly fields | `scripts/041_organization_integrations_calendly.sql` | same | same |

Both are safe to re-run (use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).

After applying, the Slack/Teams integration is fully live — no further setup required. Customers can already start adding webhooks via `/settings/integrations/webhooks` if they're admins.

---

## 2. Register the Calendly OAuth app

You'll create one OAuth app per environment (staging and production). Calendly does not have a "test redirect" mechanism the way some providers do; you need the real Vercel URL for each.

1. Sign in at https://developer.calendly.com with the account you want to own the integration (use your founder Calendly account).
2. Click **My Apps** → **Create new app** → **OAuth**.
3. Fill in the form:
   - **App name**: `HRHandle (staging)` for the first one, `HRHandle (production)` for the second
   - **Website URL**: `https://staging.hrhandle.com` / `https://hrhandle.com`
   - **Webhook signing key**: leave blank (the per-subscription signing key Calendly returns is what we use)
   - **Redirect URI**: `https://staging.hrhandle.com/api/auth/calendly/callback` for staging; `https://hrhandle.com/api/auth/calendly/callback` for production. For local dev, also add `http://localhost:3000/api/auth/calendly/callback` to the staging app.
   - **Scopes**: select `default` (full read/write to the user's data — required for `event_types`, `webhook_subscriptions`)
4. Save. You'll see a **Client ID** + **Client Secret** on the resulting page. Copy both.

You should now have:

| | Staging | Production |
|---|---|---|
| Calendly client ID | `…paste here…` | `…paste here…` |
| Calendly client secret | `…paste here…` | `…paste here…` |

---

## 3. Add Vercel environment variables

Both environments need the corresponding Calendly client ID + secret. In the Vercel dashboard → Project → Settings → Environment Variables:

For the **staging** environment (apply to "Preview" or whichever scope you use for staging):

```
CALENDLY_CLIENT_ID = <staging app client id>
CALENDLY_CLIENT_SECRET = <staging app client secret>
```

For the **production** environment:

```
CALENDLY_CLIENT_ID = <production app client id>
CALENDLY_CLIENT_SECRET = <production app client secret>
```

These have **lenient validation** in `lib/env.ts` (`.optional()` + `.min(1)`) — matching the existing pattern for Google / Microsoft / Zoom secrets. If the vars are missing, the Calendly settings page will display a friendly "not configured" message rather than breaking the build.

After saving, **redeploy** both environments (Vercel does this automatically on env-var change for most plans, but force a redeploy if you don't see the "Connect Calendly" button working).

---

## 4. Verify

### Slack + Teams

1. Visit `/settings/integrations/webhooks` as an org admin.
2. Click **Add webhook**.
3. **Slack path**: in Slack → "+ Add apps" → Incoming Webhooks → "Add to Slack" → pick channel → copy the URL → paste into HRHandle → name it (e.g., `#hiring`) → save.
4. **Teams path**: in the target channel → "···" menu → Connectors → Incoming Webhook → Configure → name + image → copy URL → paste into HRHandle → save.
5. Click the **Test** button — you should see a "HRHandle test notification" appear in the channel within a second.
6. Trigger a real event (e.g., move an application to Hired) and confirm it lands.

### Calendly

1. Visit `/settings/integrations/calendly` as an org admin.
2. Click **Connect Calendly** → log in via the OAuth flow → grant access → you'll be redirected back to `/settings/integrations/calendly?connected=1`.
3. Pick an event type from the dropdown → click **Save**.
4. Open any candidate's evaluation panel and click **Calendly link**.
5. Copy the generated URL and book a slot with a test browser (or send to your own email).
6. Within ~10 seconds of booking, the **Interviews** page should show a new row for the candidate, and any subscribed Slack/Teams channel should see an `interview_scheduled` notification.

If the webhook receiver rejects the booking with a 401, double-check that the **redirect URI on the Calendly OAuth app matches the deployment** exactly (including https + no trailing slash).

---

## 5. Rollback / disable

If anything misbehaves in production:

- **Disable a single org's webhook** without code change: org admin toggles the row off at `/settings/integrations/webhooks`.
- **Disable Calendly for a single org**: org admin clicks Disconnect at `/settings/integrations/calendly`.
- **Disable Calendly for the whole environment**: remove `CALENDLY_CLIENT_ID` from Vercel and redeploy. The connection page will show "not configured" and no new connects will succeed (existing connections will still try to refresh and fail gracefully).
- **Reverse the migrations**: not recommended — both are additive (new table + new nullable columns). Customer-visible drops would require a separate forward migration.

---

## Open items / things I deferred

- **PDF or email-sent receipts** for the Calendly link button — v1 generates a URL the recruiter copies into their own email client. Sending via Resend from HRHandle's side is a v2 once a customer asks.
- **Per-recruiter Calendly accounts** — v1 is org-wide (one Calendly user per HRHandle org). Per-recruiter would need a join table + a recruiter-picks-the-link UI; deferred until a customer needs it.
- **Multiple event types per org** — same reasoning.
- **Cal.com** — deliberately skipped (Calendly is the integration with paid-customer demand; Cal.com would be free-tier convenience).
