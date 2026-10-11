import Link from 'next/link'
import { ContactBlock, List, Mail, P, Section } from '../parts'
import { BUSINESS_ID } from '@/lib/legal/contact'
import {
  REFUND_LIMIT_MONTHS,
  REFUND_PAYOUT_BUSINESS_DAYS,
  REFUND_REQUEST_DAYS,
} from '@/lib/legal/documents'

export function RefundEn() {
  return (
    <>
      <Section title="1. Overview">
        <P first>
          This Refund Policy applies to all paid subscriptions for HRHandle, operated by Aleksandre
          Merabishvili, Individual Entrepreneur, identification number {BUSINESS_ID}, Tbilisi,
          Georgia.
        </P>
        <P>
          We want you to be satisfied with HRHandle. If you are not happy with your subscription,
          you may request a refund under the conditions described below.
        </P>
      </Section>

      <Section title="2. Free Trial">
        <P first>
          HRHandle offers a 7-day free trial. No payment is taken during the trial. You are charged
          only if you choose a paid plan. If the trial ends and you do not subscribe, access to the
          Service is paused until you do, and you are not charged.
        </P>
      </Section>

      <Section title="3. Refund Eligibility">
        <P first>You are eligible to request a refund if:</P>
        <List>
          <li>
            Your refund request is submitted within <strong>{REFUND_REQUEST_DAYS} calendar days</strong>{' '}
            of the payment date.
          </li>
          <li>
            The request is for the most recent payment only (refunds are not available for past
            billing periods).
          </li>
          <li>
            Your organization has not received a refund in the previous{' '}
            <strong>{REFUND_LIMIT_MONTHS} months</strong>. Each organization can receive at most one
            refund in any {REFUND_LIMIT_MONTHS}-month period.
          </li>
        </List>
        <P>
          Requests submitted more than {REFUND_REQUEST_DAYS} days after the payment date, or while a
          previous refund is less than {REFUND_LIMIT_MONTHS} months old, are not eligible unless
          required by applicable law.
        </P>
      </Section>

      <Section title="4. Non-Refundable Items">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Payment processing fees</strong> charged by the payment provider are
            non-refundable and are deducted from the refunded amount.
          </li>
          <li>
            Partial periods — if you cancel mid-cycle without a refund, the unused days of your
            current billing period are not refunded.
          </li>
        </ul>
      </Section>

      <Section title="5. How to Request a Refund">
        <P first>
          Email us at <Mail /> or use our{' '}
          <Link href="/support" className="underline">
            support form
          </Link>
          , and include:
        </P>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>The email address associated with your HRHandle account</li>
          <li>The date of the payment you want refunded</li>
          <li>A brief reason for the request (optional, but helpful)</li>
        </ul>
        <P>We will review your request and respond within 3 business days.</P>
      </Section>

      <Section title="6. Refund Processing Time">
        <P first>
          Once a refund is approved, we send it to your original payment method within{' '}
          <strong>{REFUND_PAYOUT_BUSINESS_DAYS} business days</strong>. After that, your bank or
          card issuer may need additional time to show it in your account; this is outside our
          control.
        </P>
      </Section>

      <Section title="7. Subscription Cancellation">
        <P first>
          A refund request alone does not cancel your subscription. To stop future billing, cancel
          your subscription in your account settings. When a refund is issued, your paid
          subscription is cancelled and auto-renewal stops: if your free trial period has not yet
          ended, you return to the trial for its remaining days; otherwise access ends until you
          subscribe again.
        </P>
        <P>
          If you cancel without a refund, you keep access to the Service until the end of your
          current paid billing period.
        </P>
      </Section>

      <Section title="8. Exceptional Circumstances">
        <P first>
          If you believe you have been charged in error, or if technical issues on our side prevented
          you from using the Service, please contact us even if the {REFUND_REQUEST_DAYS}-day window
          has passed. We will review each case individually.
        </P>
      </Section>

      <Section title="9. Governing Law">
        <P first>
          This Refund Policy is governed by the laws of Georgia. For consumers in the European Union,
          mandatory consumer protection rights under applicable EU law are not affected by this
          policy.
        </P>
      </Section>

      <Section title="10. Contact">
        <ContactBlock locale="en" />
      </Section>
    </>
  )
}
