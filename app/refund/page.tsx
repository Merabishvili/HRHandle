import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Refund Policy — HRHandle',
}

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to HRHandle
          </Link>
        </div>

        <h1 className="mb-2 text-3xl font-bold text-foreground">Refund Policy</h1>
        <p className="mb-10 text-sm text-muted-foreground">Last updated: April 22, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="mb-3 text-lg font-semibold">1. Overview</h2>
            <p>
              This Refund Policy applies to all paid subscriptions for HRHandle, operated by
              Aleksandre Merabishvili, Individual Entrepreneur, registration number 01019062001,
              Tbilisi, Georgia.
            </p>
            <p className="mt-3">
              We want you to be satisfied with HRHandle. If you are not happy with your
              subscription, you may request a refund under the conditions described below.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">2. Free Trial</h2>
            <p>
              HRHandle offers a 7-day free trial. No payment is taken during the trial period.
              You will only be charged when you choose to upgrade to a paid plan after the
              trial ends. If you do not upgrade, your account will be downgraded automatically
              and you will not be charged.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">3. Refund Eligibility</h2>
            <p>
              You are eligible to request a refund if:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Your refund request is submitted within <strong>7 calendar days</strong> of the
                payment date.
              </li>
              <li>
                The request is made for the most recent payment only (refunds are not available
                for past billing periods).
              </li>
            </ul>
            <p className="mt-3">
              Refund requests submitted after 7 days of the payment date will not be eligible
              unless required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">4. Non-Refundable Items</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Payment processing fees</strong> charged by the payment provider are
                non-refundable and will be deducted from the refunded amount.
              </li>
              <li>
                Partial periods — if you cancel mid-cycle, the remaining unused days of your
                current billing period are not refunded unless a full refund is granted under
                Section 3.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">5. How to Request a Refund</h2>
            <p>To request a refund, email us at:</p>
            <p className="mt-3">
              <a href="mailto:hrhandle26@gmail.com" className="underline">hrhandle26@gmail.com</a>
            </p>
            <p className="mt-3">Please include the following in your request:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>The email address associated with your HRHandle account</li>
              <li>The date of the payment you are requesting a refund for</li>
              <li>A brief reason for the refund request (optional but helpful)</li>
            </ul>
            <p className="mt-3">
              We will review your request and respond within 3 business days.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">6. Refund Processing Time</h2>
            <p>
              Once a refund is approved, we will initiate the refund through the original
              payment method. The time it takes for the refund to appear in your account
              depends on your bank and card issuer's clearing processes, and is typically
              between <strong>5 and 14 business days</strong>. This is outside our control
              and we cannot accelerate it.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">7. Subscription Cancellation</h2>
            <p>
              Requesting a refund does not automatically cancel your subscription. If you
              would like to cancel future billing, please cancel your subscription from
              within your account settings in addition to submitting a refund request.
            </p>
            <p className="mt-3">
              Upon cancellation, you will retain access to the Service until the end of your
              current paid billing period.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">8. Exceptional Circumstances</h2>
            <p>
              If you believe you have been charged in error, or if technical issues on our
              side prevented you from using the Service, please contact us even if the 7-day
              window has passed. We will review each case individually.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">9. Governing Law</h2>
            <p>
              This Refund Policy is governed by the laws of Georgia. For consumers in the
              European Union, mandatory consumer protection rights under applicable EU law
              are not affected by this policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">10. Contact</h2>
            <p>
              Aleksandre Merabishvili, Individual Entrepreneur<br />
              Tbilisi, Georgia<br />
              <a href="mailto:hrhandle26@gmail.com" className="underline">hrhandle26@gmail.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 flex gap-6 border-t border-border pt-8 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">Terms and Conditions</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}
