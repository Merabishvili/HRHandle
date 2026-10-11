# Flitt — payment gateway (subscription billing)

_Last updated: 2026-10-09_

Flitt (portal.flitt.com — the rebranded Fondy engine) processes subscription
payments for the paid plans. Multi-currency (**GEL / EUR / USD**), auto-recurring,
single processor. Replaces the never-built LemonSqueezy plan.

## Status

**Built, wired, and testable — not yet live.** The merchant is on Flitt's **test
environment**; go live after the pre-production checklist below is satisfied and
Flitt switches the merchant to production.

## How it works

Hosted checkout + server callback:

1. Owner/admin clicks **Upgrade** → server action `startPlanCheckout` resolves the
   org's currency + amount, records a pending `payment_orders` row, and asks Flitt
   for a checkout URL (`Subscription()` — protocol 2.0, so nested `recurring_data`
   is signed correctly).
2. The user is redirected to Flitt's hosted page (card / Google Pay / Apple Pay).
3. Flitt charges the first period, tokenizes the card, and **auto-renews** each
   cycle.
4. On every charge Flitt POSTs a signed **server callback** to
   `/api/payments/flitt/callback`. That route is the source of truth: it verifies
   the signature, matches the stored amount/currency (anti-tamper), and applies
   the subscription lifecycle below.

The browser return URL (`/settings/billing?checkout=return`) only shows a
"confirming your payment" banner — the callback does the real work.

## Recurring schedule (`recurring_data`)

Built by the pure `buildRecurringData` in
[`lib/flitt/recurring.ts`](../../lib/flitt/recurring.ts) (unit-tested), per
[docs.flitt.com/api/subscriptions](https://docs.flitt.com/api/subscriptions/)
(`every` / `period` / `amount` mandatory, plus `quantity` **or** `end_time`):

- **`start_time` = the next billing date** (today in **Asia/Tbilisi** + one
  period, `YYYY-MM-DD`): the checkout charges the first period, the schedule's
  first charge is the first renewal.
- **`end_time` = start + 10 years** (`RECURRING_HORIZON_YEARS`); no `quantity`.
  Cancel stops the schedule earlier.
- **`state: 'shown_readonly'`** — the schedule is shown but the payer can't
  switch auto-renew off on Flitt's page (`'y'` allows that, leaving us expecting
  renewals that never come). Customers cancel from `/settings/billing`.

**Why explicit dates (2026-10-09 incident).** With `start_time` omitted, Flitt's
checkout page filled the dates itself and **submitted each one a day earlier
than it displayed** for a UTC+4 browser (showed 08/10/2026 → sent
`"2026-10-07"`; 08/10/2031 → `"2031-10-07"`), i.e. a start date in the past →
the payment was declined with **"2008 Order parameters are incorrect"**. A first
attempt that added `quantity` didn't help: the page still added its own 5-year
end date, contradicting `quantity` (120 payments vs 60 months). Our start date
is a full period ahead, so even with that one-day shift it stays in the future;
a renewal arriving a day early just extends from the current period end.

**Verify after the first live-flow payment:** the subscription's next scheduled
charge in the Flitt portal should be ~1 period after the checkout payment. If it
shows two periods, Flitt counts `start_time` as an anchor (+1 period) — then
send today's date instead.

## Subscription lifecycle

The callback route does lookups + writes; every decision is the pure
`decideCallback` in [`lib/flitt/lifecycle.ts`](../../lib/flitt/lifecycle.ts)
(unit-tested).

| Callback | Effect |
|---|---|
| `approved`, first payment | `subscriptions` → `active`, period = now → +1 month/year, `payment_provider_subscription_ref` = our order id. If the org had a different recurring (plan change / re-pay after a failed renewal), the old one is **stopped** at Flitt so the card isn't charged twice. |
| `approved`, renewal | Period extended from the **current period end** (or now if it already lapsed). `past_due` → `active`. |
| `declined`, renewal | `subscriptions.status` → `past_due`; header shows a "Payment failed · Fix" pill, billing page shows a notice. |
| `declined` / `expired`, first payment | Recorded only (`last_payment_status`); plan unchanged. |
| **Full refund** (`reversed`, or `reversal_amount` ≥ the charge) | **Paid plan ends now** (decision 2026-10-09): recurring **stopped** at Flitt; if the org's 7-day trial is still running it goes **back to the trial** for the remaining days (`refundedSubscriptionUpdate`), otherwise `status` → `expired` (locked; the org can buy again). `billing_refunded` audit row; Sentry info (error if the stop isn't confirmed). |
| **Partial refund** (`reversal_amount` < the charge — the normal case, since the processing fee is deducted) | Recorded (`last_payment_status: partially_reversed` + `billing_refunded` audit row) + Sentry warning; access unchanged — follow the runbook below. |
| Exact retry (same status + `payment_id`) | Ignored. |
| Amount/currency mismatch | Ignored + Sentry error. |
| Event for a recurring the org already replaced | Not applied; that recurring is stopped + Sentry warning. |

**Renewal shape is unverified** (Flitt's docs are unreliable here), so both are
handled: a renewal under the **same order id** (detected by a new `payment_id`
on an already-approved order), or under a **new order id** carrying ours as a
prefix / in `parent_order_id` — recorded as its own `payment_orders` row copied
from the root order (UNIQUE `order_id` keeps retries idempotent). Confirm the real
shape on the test merchant before go-live.

**Lockout** — [`lib/billing/access.ts`](../../lib/billing/access.ts)
`isSubscriptionLocked`, used by the dashboard layout (redirect to
`/settings/billing` on full page loads, via `shouldRedirectToBilling` + the
`x-pathname` header), `SubscriptionLockGate` (same rule on client navigation —
layouts don't re-render there) and the billing page:
- expired trial → locked (unchanged);
- paid plan with auto-renew on → locked **3 days** (`RENEWAL_GRACE_DAYS`) after
  `current_period_end_at`, so a late or failed renewal can recover;
- auto-renew canceled (`next_billing_at` null) → locked right at the period end;
- no `current_period_end_at` (manual / complimentary plan) → never locked.

A locked or `past_due` org can buy its plan again from the billing page (the
"current plan" button is only disabled while the plan is in good standing).

**What the user sees:**
- `past_due` → red "Payment failed · Fix" pill in the header at **every** width
  (compact link on mobile) + a notice on the billing page.
- Locked → every dashboard page redirects to billing, which shows "Your paid plan
  has ended" and an **`expired`** badge (`displaySubscriptionStatus` — the stored
  row isn't rewritten when a period just runs out).
- **Members** normally can't open billing, but while the org is locked they get
  a **read-only** view (`canViewBilling`) — redirecting them away would loop
  pipeline ⇄ billing. Plan buttons + currency are disabled with "Ask an owner or
  admin".
- **No billing emails yet** (plan ending / payment failed / plan ended) — deferred:
  they need a daily cron and the Vercel Hobby plan has no free cron slot. See the
  roadmap.

## Refund handling (operator runbook)

Policy (Refund Policy §3–§6, decisions 2026-10-09): request within **7 days** of
the payment, most recent payment only, **at most one refund per organization in
any 3 months**, we send approved refunds within **14 business days**, minus the
**processing fee**. Because the fee is deducted, a refund is *partial* in Flitt's
terms, so HRHandle only records + flags it — the steps below are manual.

Every refund HRHandle receives is recorded as a `billing_refunded` row in
`activity_log` (`details.orderId`, `reversalMinor`, `full`). A second refund for
the same org inside the window raises a Sentry **error**
("second refund within the refund-limit window").

1. **Check eligibility** (Supabase SQL, prod) — any row with a `refunded_at` means
   the org already had a refund in the last 3 months → decline:
   ```sql
   select o.id as org_id, o.name,
          a.created_at as refunded_at, a.details->>'orderId' as refunded_order
   from profiles p
   join organizations o on o.id = p.organization_id
   left join activity_log a on a.organization_id = o.id
        and a.action = 'billing_refunded'
        and a.created_at > now() - interval '3 months'
   where p.email = '<customer email>';

   select order_id, amount_minor, currency, status, created_at
   from payment_orders where organization_id = '<org_id>'
   order by created_at desc limit 3;   -- last payment must be ≤ 7 days old
   ```
2. **Refund in the Flitt portal**: Payments → the order → Refund, amount minus the
   processing fee. Then re-run the first query: if no new `billing_refunded` row
   appears, **resend the order's callback** from the Flitt portal (that's what
   records it in the history).
3. **Stop auto-renewal** — the order id is the subscription's root order:
   ```sql
   select payment_provider_subscription_ref from subscriptions where organization_id = '<org_id>';
   ```
   ```bash
   FLITT_MERCHANT_ID=4056901 FLITT_SECRET_KEY=<payment key> \
     node scripts/flitt-subscription.mjs stop <payment_provider_subscription_ref>
   ```
4. **End access** (policy: a refund cancels the paid subscription):
   ```sql
   -- trial already over (usual case) → locked, can buy again
   update subscriptions
   set status = 'expired', current_period_end_at = now(), next_billing_at = null
   where organization_id = '<org_id>';

   -- trial still running (bought during the trial) → back to the trial
   update subscriptions
   set plan_code = 'trial', status = 'trial', billing_cycle = null,
       current_period_start_at = null, current_period_end_at = null, next_billing_at = null,
       payment_method_linked = false, vacancy_limit = 5, candidate_limit = 100, member_limit = 2
   where organization_id = '<org_id>';
   ```

## Cancel + checking a subscription's status

The Flitt portal shows a subscription's schedule but **not whether it's on or
off**, so Flitt's reply to the stop request is the only proof:

- In-app **Cancel** (`cancelSubscription` → `stopSubscription`) only clears
  `next_billing_at` (shows "auto-renew off") when Flitt's reply confirms the stop
  (`isStopConfirmed`: `response_status: success` and not `active`). The reply's
  `status` is saved in the `billing_subscription_canceled` audit row.
- To check or stop any subscription by order ID (e.g. test orders HRHandle never
  linked), run — key inline, never committed:

  ```bash
  FLITT_MERCHANT_ID=4056901 FLITT_SECRET_KEY=<payment key> \
    node scripts/flitt-subscription.mjs stop <order_id> [<order_id> …]
  ```

  It prints `response_status` + `status` per order. Stopping twice is harmless.

## SDK

Uses the official [`@flittpayments/flitt-node-js-sdk`](https://github.com/flittpayments/node-js-sdk)
— dependency-free (Node `crypto`/`https` only). It signs requests and verifies
callbacks (`isValidResponse`). Its shipped `.d.ts` declares the wrong (unscoped)
module name, so we ship an ambient declaration at
[`types/flitt-node-js-sdk.d.ts`](../../types/flitt-node-js-sdk.d.ts).

> The signature examples in Flitt's web docs are unreliable when paraphrased —
> **the SDK source is ground truth.** Algorithm: sort params by key, drop
> empty-string values + `signature`/`response_signature_string`, then
> `sha1(secret + '|' + values.join('|'))`. Recurring uses protocol 2.0
> (base64-of-JSON, signed as `sha1(secret + '|' + base64)`).

## Environment variables

Server-only. Set on **both** Vercel environments (staging + production), from
portal.flitt.com. See [`docs/5-environment/variables.md`](../5-environment/variables.md).

| Variable | Purpose |
|---|---|
| `FLITT_MERCHANT_ID` | Numeric merchant id |
| `FLITT_SECRET_KEY` | Payment/secret key — signs checkouts + verifies callbacks. **Never** `NEXT_PUBLIC_`. |

Unset → `isFlittConfigured()` is false and the checkout fails soft (button shows a
"not configured" toast); the build never breaks.

**Test vs live merchant:** ideally request a permanent **sandbox** merchant so
staging always uses test creds and never charges real cards once the live merchant
is active; production uses the live merchant. If only one merchant exists (toggled
test→live), point staging at a test merchant or disable checkout there before
go-live.

**Callback / response URLs** use the **host serving the request**
(`callbackOrigin()` in [`lib/site-url.ts`](../../lib/site-url.ts)), not
`NEXT_PUBLIC_SITE_URL`: the apex `hrhandle.com` **307-redirects to
`www.hrhandle.com`**, and Flitt's server callback does not follow redirects —
with the apex URL a paid order never activated the plan (2026-10-09). Register
the **www** host in the Flitt portal:
`https://www.hrhandle.com/api/payments/flitt/callback` (prod) and
`https://staging.hrhandle.com/api/payments/flitt/callback` (staging merchant).

## Currency model

One processor, three currencies. Currency is resolved per org from
`organizations.billing_country` (**GE → GEL, EU/EEA → EUR, else → USD**) with a
manual `organizations.billing_currency` override on the billing page. Georgian
customers **must** be shown GEL (local law) — the public landing pricing defaults
to GEL for the same reason. See [`lib/pricing/currency.ts`](../../lib/pricing/currency.ts)
(reuses the EU/EEA list from `lib/ai/fit-geofence.ts`). Prices live in
`PRICING_PLANS` ([`lib/types/subscription.ts`](../../lib/types/subscription.ts)),
per-currency; amounts are converted to minor units (tetri/cents, ×100) for Flitt.

## Files

| File | Role |
|---|---|
| `lib/flitt/client.ts` | SDK wrapper: `createSubscriptionCheckout`, `stopSubscription`, `verifyCallback`, `isFlittConfigured` |
| `lib/flitt/callback.ts` | Pure `normalizeCallback` (protocol 1.0 flat + 2.0 base64) |
| `lib/flitt/types.ts` | Callback + status types |
| `lib/flitt/recurring.ts` | Pure `buildRecurringData` — the `recurring_data` contract (`start_time` / `end_time` in Tbilisi time, `state`) |
| `lib/flitt/lifecycle.ts` | Pure `decideCallback`, renewal detection (`findParentOrderId`), `addPeriod` |
| `lib/billing/access.ts` | Pure `isSubscriptionLocked` + `RENEWAL_GRACE_DAYS` (dashboard lockout) |
| `lib/actions/billing.ts` | `startPlanCheckout`, `cancelSubscription`, `setBillingCurrency` (owner/admin) |
| `app/api/payments/flitt/callback/route.ts` | Signed callback → updates `subscriptions` |
| `lib/pricing/currency.ts` | Currency resolution + formatting |
| `components/subscription/plan-cards.tsx` | Upgrade buttons (wired) |
| `components/subscription/billing-controls.tsx` | Currency override + cancel |
| `components/subscription/payment-methods.tsx` | Visa/MC/GPay/ApplePay marks |
| `supabase/migrations/20260804_flitt_billing.sql` | `payment_orders` + `organizations.billing_currency` |

## Portal settings (production merchant `hrhandle.com`)

Configured 2026-10-09 — replicate on the staging test merchant with
`staging.hrhandle.com` URLs:

- **Payment settings:** Redirect method to the result page = **GET** (a cross-site
  POST return arrives without the `SameSite=Lax` Supabase cookies → the payer
  would land logged out). Server Callback URL + Subscription callback URL =
  `https://www.hrhandle.com/api/payments/flitt/callback` — **www**: the apex
  307-redirects and the callback is lost. T&C URL =
  `https://hrhandle.com/terms`. Save card / pre-auth off (recurring tokenizes
  the card itself). Success/Decline URLs empty (we send `response_url` per order).
- **Notifications:** customer emails in **English** (non-Georgian payers);
  disputes + reports → `hrhandle26@gmail.com`.
- **Payment methods:** Google Pay on (still "Environment TEST" — confirm it
  switches with the live switch), Apple Pay on with Flitt's certificate (hosted
  checkout → no domain verification needed).
- **Settlement:** GEL account only.

## Pre-production checklist (Flitt's requirements)

- [x] Product descriptions + **GEL** prices on the site (landing defaults to GEL; Georgian orgs billed in GEL)
- [x] Terms: entity name + ID + digital-delivery + refund (Terms §5, `/refund`)
- [x] Privacy policy (`/privacy`)
- [x] Contact — email, **phone**, and full **address** ([`lib/legal/contact.ts`](../../lib/legal/contact.ts): 29 Tskneti Highway, Tbilisi; +995 599 89 29 17) on all legal pages (Terms/Privacy/Refund). **Removed from the landing footer** to limit public exposure of the sole-proprietor's personal identity — the footer keeps links to the legal pages, which satisfies disclosure. If Flitt/the acquirer requires the full identity on the homepage itself before the live switch, restore the block in [`app/page.tsx`](../../app/page.tsx).
- [x] Visa/Mastercard (+ Google Pay / Apple Pay) marks on the site
- [ ] Test all three methods (card, Google Pay, Apple Pay) on the test merchant
- [ ] Email Flitt to request the production switch, then set live creds on Vercel
- [ ] **Confirm EUR/USD acceptance** with Flitt — settlement is GEL-only; if the
  merchant can't take EUR/USD, switch to charging everyone in GEL (deferred
  decision, 2026-10-09)
- [ ] **Confirm the renewal callback shape** (same vs new `order_id`; which
  callback URL) — both are handled, but verify with a short-period recurring on
  the test merchant
- [ ] Staging → its own **test merchant** creds on the staging Vercel env
- [ ] Rotate the payment key if Flitt allows (it was shared in a screenshot)
- [x] Legal pages audited + available in EN/KA/RU (2026-10-09) — content in
  `components/legal/content/*`, shared facts in `lib/legal/documents.ts`

## Gotchas

- The callback route is on the **Node runtime** (SDK uses `https`). It's already
  unauthenticated — `updateSession` only redirects `/dashboard|/pipeline|/onboarding`
  and exempts `/api/`, so no middleware change was needed.
- Writes to `payment_orders` + `subscriptions` go through the **admin client**
  (service role); RLS gives org members read-only access. Clients can never forge
  an order or flip its status.
- The migration must be applied on **both** Supabase projects (staging then prod).
