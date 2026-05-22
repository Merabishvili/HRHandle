# LemonSqueezy — PLANNED / NOT YET IMPLEMENTED

_Last updated: 2026-05-08_

## Changelog

- 🔄 Status unchanged — still planned, no code or env vars present yet
- 🆕 Pricing UI now shows "Spring Offer" campaign discounts (`lib/campaign.ts`) but the "Upgrade Now" button is still not wired to any payment provider

---

## Status

**This integration is planned but has not been implemented.** No LemonSqueezy code exists in the codebase. The subscription and billing UI is present (pricing cards, subscription page) but payment processing is not wired up.

## Purpose

LemonSqueezy will handle subscription billing for the Individual and Organization paid plans.

## Plans

From `lib/types/subscription.ts` and `lib/campaign.ts`:

| Plan | Monthly | Annual | Vacancies | Candidates | Members |
|---|---|---|---|---|---|
| Trial | Free (7 days) | — | 5 | 100 | 2 |
| Individual | $20/mo | $16/mo | 500 | 10,000 | 3 |
| Organization | $40/mo | $32/mo | 1,000 | 20,000 | 50 |

A "Spring Offer" campaign (`lib/campaign.ts`) defines discounts of 60% monthly and 70% annual until 2026-06-01. These discounts are displayed in the pricing UI but not yet applied to actual payments.

## What Will Be Needed

### Environment Variables

| Variable | Purpose |
|---|---|
| `LEMONSQUEEZY_API_KEY` | LemonSqueezy API key for creating checkouts and verifying webhooks |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook signature secret for verifying webhook payloads |
| `LEMONSQUEEZY_STORE_ID` | LemonSqueezy store ID |
| `LEMONSQUEEZY_INDIVIDUAL_MONTHLY_VARIANT_ID` | Product variant ID for Individual plan, monthly billing |
| `LEMONSQUEEZY_INDIVIDUAL_ANNUAL_VARIANT_ID` | Product variant ID for Individual plan, annual billing |
| `LEMONSQUEEZY_ORGANIZATION_MONTHLY_VARIANT_ID` | Product variant ID for Organization plan, monthly billing |
| `LEMONSQUEEZY_ORGANIZATION_ANNUAL_VARIANT_ID` | Product variant ID for Organization plan, annual billing |

### Webhook Endpoint

An API route (e.g. `app/api/webhooks/lemonsqueezy/route.ts`) will need to:
1. Verify the `X-Signature` header using `LEMONSQUEEZY_WEBHOOK_SECRET`
2. Handle events: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_payment_success`, `subscription_payment_failed`, `subscription_expired`
3. Update the `subscriptions` table with new `plan_code`, `status`, `billing_cycle`, `current_period_start_at`, `current_period_end_at`, `next_billing_at`, `payment_method_linked`, `payment_provider_customer_ref`, `payment_provider_subscription_ref`, `last_payment_status`

### Checkout Flow

The `PlanCards` component (`components/subscription/plan-cards.tsx`) renders upgrade buttons. These will need to redirect to a LemonSqueezy checkout URL created server-side with the user's email pre-filled and a `custom_data` object containing `organization_id` for webhook correlation.

## Current Subscription Table Usage

The `subscriptions` table already has columns for LemonSqueezy:
- `payment_provider_customer_ref` — LemonSqueezy customer ID
- `payment_provider_subscription_ref` — LemonSqueezy subscription ID
- `payment_method_linked` — whether a payment method has been attached
- `last_payment_status` — result of the last payment attempt

When `status === 'expired'` or trial has ended, users are redirected to `/subscription` (the plan selection page) by the dashboard layout.
