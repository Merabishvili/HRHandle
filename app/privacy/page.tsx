import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — HRHandle',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to HRHandle
          </Link>
        </div>

        <h1 className="mb-2 text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mb-10 text-sm text-muted-foreground">Last updated: April 22, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="mb-3 text-lg font-semibold">1. Who We Are</h2>
            <p>
              HRHandle is operated by Aleksandre Merabishvili, Individual Entrepreneur,
              registration number 01019062001, Tbilisi, Georgia ("we", "us", "our").
            </p>
            <p className="mt-3">
              We are the data controller for the personal data of our customers (account holders
              and their team members). For candidate data that you enter into the Service, you
              are the data controller and we act as a data processor on your behalf.
            </p>
            <p className="mt-3">
              Contact: <a href="mailto:hrhandle26@gmail.com" className="underline">hrhandle26@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">2. What Data We Collect</h2>

            <h3 className="mb-2 mt-4 font-medium">2.1 Account and Organization Data</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Name and email address of account holders and team members</li>
              <li>Organization name and configuration settings</li>
              <li>Subscription and billing information (processed by our payment provider — we do not store card details)</li>
              <li>Usage activity within the Service (e.g. actions taken, features used)</li>
            </ul>

            <h3 className="mb-2 mt-4 font-medium">2.2 Vacancy Data</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Job titles, descriptions, departments, locations, and requirements</li>
              <li>Salary information and hiring timelines</li>
            </ul>

            <h3 className="mb-2 mt-4 font-medium">2.3 Candidate Data</h3>
            <p className="mb-2">
              You enter candidate data into HRHandle as part of your recruitment process. This
              may include:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Full name, email address, and phone number</li>
              <li>Date of birth</li>
              <li>Current company and position, years of experience</li>
              <li>LinkedIn profile URL</li>
              <li>CVs, resumes, cover letters, and other uploaded documents</li>
              <li>Recruiter notes and interview records</li>
              <li>Application status and history</li>
            </ul>
            <p className="mt-3">
              Some of this data may be imported by your recruiters directly from LinkedIn. You
              are responsible for ensuring you have a lawful basis to collect and store this
              data under applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">3. How We Use Your Data</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>To provide, operate, and improve the Service</li>
              <li>To manage your subscription and process payments</li>
              <li>To send transactional emails (account invitations, password resets)</li>
              <li>To monitor for errors and technical issues (via Sentry)</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We do not use your data or your candidates' data for advertising or marketing
              purposes, and we do not sell data to third parties.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">4. Legal Basis for Processing</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Contract performance:</strong> processing necessary to deliver the Service under our Terms</li>
              <li><strong>Legitimate interests:</strong> monitoring service health, preventing abuse</li>
              <li><strong>Legal obligation:</strong> complying with applicable laws</li>
              <li><strong>Consent:</strong> where you have explicitly provided it (e.g. marketing communications, if any)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">5. Third-Party Services</h2>
            <p>We use the following sub-processors to provide the Service:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium">Provider</th>
                    <th className="pb-2 pr-4 font-medium">Purpose</th>
                    <th className="pb-2 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-2 pr-4">Supabase (AWS us-east-1)</td>
                    <td className="py-2 pr-4">Database and file storage</td>
                    <td className="py-2">USA</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Resend</td>
                    <td className="py-2 pr-4">Transactional email delivery</td>
                    <td className="py-2">USA</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Sentry</td>
                    <td className="py-2 pr-4">Error monitoring</td>
                    <td className="py-2">USA</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Vercel</td>
                    <td className="py-2 pr-4">Hosting and deployment</td>
                    <td className="py-2">USA / Global CDN</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              All sub-processors are contractually obligated to process data only as instructed
              and to maintain appropriate security measures.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">6. International Data Transfers</h2>
            <p>
              Your data is stored on servers located in the United States (AWS us-east-1, North
              Virginia). If you are located in the European Economic Area or Georgia, this
              constitutes a transfer of personal data outside your jurisdiction. We rely on
              standard contractual clauses and the data processing agreements of our sub-processors
              to ensure an adequate level of protection.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">7. Data Retention</h2>
            <p>
              We retain your account and organization data for as long as your account is active
              and for up to 90 days after account termination to allow for recovery requests.
            </p>
            <p className="mt-3">
              Candidate data is retained as long as you maintain an active subscription. Upon
              account deletion, all associated candidate data is permanently deleted within 30
              days, except where we are required by law to retain it longer.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">8. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Object to or restrict certain processing</li>
              <li>Receive your data in a portable format</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:hrhandle26@gmail.com" className="underline">hrhandle26@gmail.com</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">9. Cookies</h2>
            <p>
              HRHandle uses only essential cookies required for authentication and session
              management (set by Supabase Auth). We do not use tracking, advertising, or
              analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">10. Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your data,
              including encrypted data transmission (TLS), row-level security on all database
              tables, role-based access controls, and signed URLs for document access.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">11. Children</h2>
            <p>
              The Service is not directed at persons under 18. We do not knowingly collect
              personal data from anyone under 18.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of
              material changes by email or via a notice within the Service. The "last updated"
              date at the top of this page reflects the most recent revision.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">13. Contact</h2>
            <p>
              Data controller: Aleksandre Merabishvili, Individual Entrepreneur<br />
              Tbilisi, Georgia<br />
              <a href="mailto:hrhandle26@gmail.com" className="underline">hrhandle26@gmail.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 flex gap-6 border-t border-border pt-8 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">Terms and Conditions</Link>
          <Link href="/refund" className="hover:text-foreground">Refund Policy</Link>
        </div>
      </div>
    </div>
  )
}
