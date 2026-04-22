import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms and Conditions — HRHandle',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to HRHandle
          </Link>
        </div>

        <h1 className="mb-2 text-3xl font-bold text-foreground">Terms and Conditions</h1>
        <p className="mb-10 text-sm text-muted-foreground">Last updated: April 22, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="mb-3 text-lg font-semibold">1. Introduction</h2>
            <p>
              These Terms and Conditions ("Terms") govern your access to and use of HRHandle
              ("Service"), an applicant tracking system operated by Aleksandre Merabishvili,
              Individual Entrepreneur, registration number 01019062001, Tbilisi, Georgia
              ("we", "us", "our").
            </p>
            <p className="mt-3">
              By creating an account or using the Service, you agree to be bound by these Terms.
              If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">2. Description of Service</h2>
            <p>
              HRHandle is a cloud-based applicant tracking system that allows organizations to
              manage job vacancies, track candidates through hiring pipelines, schedule interviews,
              and store candidate-related documents and notes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">3. Eligibility</h2>
            <p>
              You must be at least 18 years old and have the legal authority to enter into a
              binding agreement on behalf of yourself or your organization. By using the Service,
              you represent that you meet these requirements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">4. Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activity that occurs under your account. You agree to notify us
              immediately at <a href="mailto:hrhandle26@gmail.com" className="underline">hrhandle26@gmail.com</a> of
              any unauthorized use of your account.
            </p>
            <p className="mt-3">
              Each organization may have one account. You may invite team members to your
              organization under your subscription. You are responsible for ensuring that all
              users in your organization comply with these Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">5. Subscriptions and Payment</h2>
            <p>
              The Service is offered under the following plans:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li><strong>Free Trial:</strong> 7 days of full access at no charge. No payment method required during trial.</li>
              <li><strong>Monthly Plan:</strong> Billed once per calendar month.</li>
              <li><strong>Annual Plan:</strong> Billed once per year. May be offered at a discounted rate compared to monthly billing.</li>
            </ul>
            <p className="mt-3">
              Plans are available for individual users and for organizations (teams). Pricing for
              each plan is displayed on the subscription page within the Service and on our
              website.
            </p>
            <p className="mt-3">
              Subscriptions renew automatically at the end of each billing period unless cancelled
              before the renewal date. You may cancel your subscription at any time from your
              account settings.
            </p>
            <p className="mt-3">
              All payments are processed by our payment provider. We do not store payment card
              details.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">6. Refunds</h2>
            <p>
              Please refer to our <Link href="/refund" className="underline">Refund Policy</Link> for
              full details. In summary, refunds may be requested within 7 days of a payment being
              made. Payment processing fees are non-refundable.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Use the Service for any unlawful purpose or in violation of applicable laws</li>
              <li>Upload or store content that is illegal, defamatory, or infringes third-party rights</li>
              <li>Attempt to gain unauthorized access to the Service or its infrastructure</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Resell or sublicense the Service without our prior written consent</li>
              <li>Use the Service to process candidate data for purposes other than legitimate recruitment activities</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">8. Candidate Data and LinkedIn Import</h2>
            <p>
              The Service allows you to store and manage candidate data, including information
              imported from LinkedIn. You are responsible for ensuring that you have a lawful basis
              for collecting and processing candidate personal data, and that your use of candidate
              data complies with applicable data protection laws, including GDPR where applicable.
            </p>
            <p className="mt-3">
              We do not share candidate data with third parties. Candidate data is used solely to
              provide the Service to you.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">9. Intellectual Property</h2>
            <p>
              The Service, including its design, code, and branding, is owned by us and protected
              by intellectual property laws. You retain ownership of all data you upload or create
              through the Service.
            </p>
            <p className="mt-3">
              By using the Service, you grant us a limited, non-exclusive licence to store and
              process your data solely for the purpose of providing the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">10. Availability and Modifications</h2>
            <p>
              We aim to maintain high availability but do not guarantee uninterrupted access to
              the Service. We reserve the right to modify, suspend, or discontinue the Service
              or any feature at any time, with reasonable notice where possible.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, we shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, including but not
              limited to loss of data, revenue, or business, arising from your use of or inability
              to use the Service.
            </p>
            <p className="mt-3">
              Our total liability to you for any claims arising from these Terms or your use of
              the Service shall not exceed the amount you paid us in the 3 months preceding the
              claim.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">12. Termination</h2>
            <p>
              We may suspend or terminate your account if you violate these Terms, fail to pay
              subscription fees, or if we are required to do so by law. Upon termination, your
              right to access the Service ceases. You may request an export of your data within
              30 days of termination by contacting us.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of Georgia. Any disputes shall be resolved
              in the courts of Tbilisi, Georgia.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">14. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes
              by email or via a notice within the Service. Continued use of the Service after
              the effective date of changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">15. Contact</h2>
            <p>
              For questions about these Terms, contact us at:{' '}
              <a href="mailto:hrhandle26@gmail.com" className="underline">hrhandle26@gmail.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 flex gap-6 border-t border-border pt-8 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          <Link href="/refund" className="hover:text-foreground">Refund Policy</Link>
        </div>
      </div>
    </div>
  )
}
