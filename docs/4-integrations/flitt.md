# Flitt — payment gateway (subscription billing)

_Last updated: 2026-08-04_

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
   the signature, matches the stored amount/currency (anti-tamper), and flips the
   `subscriptions` row to `active` on `approved`.

The browser return URL (`/settings/billing?checkout=return`) only shows a
"confirming your payment" banner — the callback does the real work.

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

**Callback / response URLs** are derived from `NEXT_PUBLIC_SITE_URL` (falling back
to the request host). Register both hosts in the Flitt portal:
`https://staging.hrhandle.com/api/payments/flitt/callback` and
`https://hrhandle.com/api/payments/flitt/callback`.

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
| `lib/actions/billing.ts` | `startPlanCheckout`, `cancelSubscription`, `setBillingCurrency` (owner/admin) |
| `app/api/payments/flitt/callback/route.ts` | Signed callback → updates `subscriptions` |
| `lib/pricing/currency.ts` | Currency resolution + formatting |
| `components/subscription/plan-cards.tsx` | Upgrade buttons (wired) |
| `components/subscription/billing-controls.tsx` | Currency override + cancel |
| `components/subscription/payment-methods.tsx` | Visa/MC/GPay/ApplePay marks |
| `supabase/migrations/20260804_flitt_billing.sql` | `payment_orders` + `organizations.billing_currency` |

## Pre-production checklist (Flitt's requirements)

- [x] Product descriptions + **GEL** prices on the site (landing defaults to GEL; Georgian orgs billed in GEL)
- [x] Terms: entity name + ID + digital-delivery + refund (Terms §5, `/refund`)
- [x] Privacy policy (`/privacy`)
- [ ] **Contact phone** — `SUPPORT_PHONE` in [`lib/legal/contact.ts`](../../lib/legal/contact.ts) is a **PLACEHOLDER**; set the real number before go-live
- [x] Visa/Mastercard (+ Google Pay / Apple Pay) marks on the site
- [ ] Test all three methods (card, Google Pay, Apple Pay) on the test merchant
- [ ] Email Flitt to request the production switch, then set live creds on Vercel

## Gotchas

- The callback route is on the **Node runtime** (SDK uses `https`). It's already
  unauthenticated — `updateSession` only redirects `/dashboard|/pipeline|/onboarding`
  and exempts `/api/`, so no middleware change was needed.
- Writes to `payment_orders` + `subscriptions` go through the **admin client**
  (service role); RLS gives org members read-only access. Clients can never forge
  an order or flip its status.
- The migration must be applied on **both** Supabase projects (staging then prod).
