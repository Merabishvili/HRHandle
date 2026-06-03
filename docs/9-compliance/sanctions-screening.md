# Sanctions Screening Policy

_Last updated: 2026-06-04_
_Owner: Aleksandre Merabishvili (sole founder + DPO)_

## Document control

- **Tracked as:** [G-008](../issues-found.md)
- **Review cadence:** quarterly (next: 2026-09), and immediately on any FATF plenary outcome that affects the call-for-action list, or on any new OFAC/EU/UN comprehensive country sanctions program
- **Related docs:** [`docs/9-compliance/ropa.md`](./ropa.md) · [`docs/9-compliance/breach-response.md`](./breach-response.md) · [`docs/issues-found.md`](../issues-found.md)

## Why HRHandle screens by country

HRHandle is a B2B SaaS sold internationally. To stay compliant with international sanctions regimes and with the merchant agreements of the payment processor we use, we operate a country-level gate at new account creation.

Until first paying-customer revenue, HRHandle's only screening is the country gate described here. When revenue justifies the cost, this policy will be supplemented with a denied-party screening service (Sumsub / ComplyCube / OpenSanctions / equivalent) for individual and entity-level matching against the consolidated SDN, EU, and UN lists. That is tracked as a future item.

## What is screened

- **Sign-up (email + OAuth)**: the country gate runs server-side at `/auth/sign-up` and at the dashboard-layout chokepoint for OAuth users who haven't yet created an organization. Both block from the same hardcoded list.
- **Existing customer sign-in**: **not** screened. Sanctions law does not require breaking pre-existing customer relationships when a regime changes or when a user travels. Locking out an established customer who happens to be on a business trip would be bad behaviour.
- **Public apply form (`/apply/[token]`)**: **not** screened. A candidate is a data subject of the customer-controller, not a counterparty of HRHandle. Gating candidates by country would create a hiring-discrimination problem, not solve a sanctions one. Recruiters who need to apply export-control screening to their own candidate pool should do so at their level.
- **Public job listings (`/jobs/[slug]`)**: **not** screened — read-only public content.

## Current blocklist

ISO 3166-1 alpha-2 codes. The list is the **union** of the FATF "call for action" list (FATF black list) and the OFAC/EU/UK comprehensive country sanctions programs. Grey-list (FATF "increased monitoring") jurisdictions are **not** included — enhanced AML monitoring at financial-institution level does not translate to a B2B SaaS sign-up block.

| Code | Country | Inclusion rationale |
|---|---|---|
| `KP` | North Korea | FATF call-for-action; OFAC comprehensive |
| `IR` | Iran | FATF call-for-action; OFAC comprehensive |
| `MM` | Myanmar | FATF call-for-action |
| `SY` | Syria | OFAC comprehensive |
| `CU` | Cuba | OFAC comprehensive |
| `BY` | Belarus | EU/UK/US comprehensive (post-2022) |
| `RU` | Russia | EU/UK/US/Japan/Switzerland comprehensive (post-2022); B2B SaaS norm |
| `VE` | Venezuela | OFAC (partial regime; blocked per B2B SaaS norm) |

The authoritative source of truth is the `BLOCKED_COUNTRY_CODES` constant in [`lib/sanctions.ts`](../../lib/sanctions.ts).

## How detection works

- The Vercel edge sets `x-vercel-ip-country` on every request, containing the ISO 3166-1 alpha-2 code derived from the visitor's IP.
- The gate reads this header at the sign-up page render. There is no third-party API call and no client-side detection — the gate cannot be tampered with from the browser.
- In **local development**, the header is absent. The gate fails open (does not block) so dev keeps working. The same fail-open applies in tests.
- In production, if Vercel cannot determine the country (rare — anonymous proxy, edge fallback), the header is absent and the gate also fails open. This is a deliberate trade-off: false positives that would lock out legitimate users (corporate VPN, mobile carrier IP) are a worse harm than the marginal extra exposure of letting an unknown-origin request through.

## Known limits

- **VPNs and proxies bypass IP geolocation.** Anyone deliberately routing through a VPN to circumvent the gate is doing so on their own initiative — the gate is a documented good-faith control, not a wall. The same applies to every payment processor and B2B SaaS that ships an IP gate.
- **The list goes stale.** Sanctions and FATF lists shift on a timescale of months. The quarterly review (below) is the maintenance mechanism. When HRHandle grows past a few customers, the right answer is to switch to a managed list (OpenSanctions snapshot, or a screening service).
- **Entity / individual screening is not in scope here.** Specific designated persons (SDN, EU consolidated list, UN 1267, etc.) are not matched by this country gate. Building that requires name-matching against fast-moving lists — to be added in a future iteration alongside paid-customer onboarding.

## Quarterly review checklist

Once per quarter (set a recurring calendar reminder):

- [ ] Open the FATF "High-Risk Jurisdictions subject to a Call for Action" page (fatf-gafi.org) and confirm that `KP`, `IR`, `MM` are still the only countries on it. If anything has been added or removed, update [`lib/sanctions.ts`](../../lib/sanctions.ts).
- [ ] Open the OFAC Sanctions Programs page (home.treasury.gov/policy-issues/financial-sanctions/sanctions-programs-and-country-information) and confirm that `SY`, `CU`, `BY`, `RU`, `VE` are still subject to comprehensive sanctions. If a country graduates off (or a new regime is added — e.g. a new comprehensive program), update the list.
- [ ] Open the EU consolidated sanctions list (sanctionsmap.eu) and confirm alignment with the above.
- [ ] If any change is made, update this document's "Last updated" date and the changelog table below, and ship a release alongside an updated test in [`lib/__tests__/sanctions.test.ts`](../../lib/__tests__/sanctions.test.ts) (the test pins the list contents).

## Changelog

| Date | Change | Reviewer |
|---|---|---|
| 2026-06-04 | Initial creation; list set to KP, IR, MM, SY, CU, BY, RU, VE. | Aleksandre Merabishvili |
