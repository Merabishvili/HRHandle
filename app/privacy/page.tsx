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
        <p className="mb-10 text-sm text-muted-foreground">Last updated: June 2, 2026</p>

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
              <li>If you sign in with Google: your Google account name, email address, and profile picture, provided via Google OAuth. We do not store your Google password.</li>
            </ul>

            <h3 className="mb-2 mt-4 font-medium">2.2 Integration Data</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>If you connect LinkedIn: your LinkedIn OAuth access token, used solely to post vacancies on your behalf. We do not access your LinkedIn connections or personal feed.</li>
              <li>If you connect Google Calendar: your Google OAuth access token and refresh token, used solely to create and manage interview calendar events on your behalf.</li>
              <li>If you connect Zoom: your Zoom OAuth access token and refresh token, used solely to create Zoom meetings when scheduling video interviews on your behalf.</li>
              <li>If you connect Microsoft: your Microsoft OAuth access token and refresh token, used solely to create Teams meetings and Outlook Calendar events when scheduling video interviews on your behalf. We do not access your emails, contacts, or any other Microsoft data.</li>
            </ul>

            <h3 className="mb-2 mt-4 font-medium">2.3 Vacancy Data</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Job titles, descriptions, responsibilities, departments, locations, and requirements</li>
              <li>Salary information and hiring timelines</li>
              <li>Evaluation criteria and scores entered by your team</li>
            </ul>

            <h3 className="mb-2 mt-4 font-medium">2.4 Candidate Data</h3>
            <p className="mb-2">
              You enter candidate data into HRHandle as part of your recruitment process, or
              candidates submit it themselves through your public application page. This may
              include:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Full name, email address, and phone number</li>
              <li>Current company and position, years of experience</li>
              <li>LinkedIn profile URL</li>
              <li>CVs, resumes, cover letters, and other uploaded documents</li>
              <li>Information automatically extracted from uploaded CVs (work experience, education) — see Section 5 for details on how this extraction works</li>
              <li>Recruiter notes and interview records</li>
              <li>Application status and history</li>
              <li>
                For candidates who apply through the public application page: the IP address from which the application was submitted. We use this to prevent abuse (rate-limiting and duplicate-submission detection). It is stored alongside the application record and deleted together with it.
              </li>
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
                  <tr>
                    <td className="py-2 pr-4">Google (optional)</td>
                    <td className="py-2 pr-4">Authentication (OAuth) and Google Calendar integration</td>
                    <td className="py-2">USA / Global</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Google Generative AI (Gemini API)</td>
                    <td className="py-2 pr-4">Automated extraction of structured fields from uploaded CVs (name, email, work experience, education) — see &quot;AI features&quot; below</td>
                    <td className="py-2">USA / Global</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">LinkedIn (optional)</td>
                    <td className="py-2 pr-4">Vacancy posting via LinkedIn API</td>
                    <td className="py-2">USA / Global</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Zoom (optional)</td>
                    <td className="py-2 pr-4">Video meeting creation via Zoom API</td>
                    <td className="py-2">USA / Global</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Microsoft (optional)</td>
                    <td className="py-2 pr-4">Teams meeting and Outlook Calendar integration via Microsoft Graph API</td>
                    <td className="py-2">USA / Global</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              All sub-processors are contractually obligated to process data only as instructed
              and to maintain appropriate security measures.
            </p>

            <h3 className="mb-2 mt-4 font-medium">5.1 AI features (CV parsing)</h3>
            <p>
              When you or a candidate uploads a CV (PDF or Word document), the file is sent to
              Google&apos;s Gemini API to extract structured fields — name, contact details, work
              experience, and education — so they can be pre-filled into the candidate record.
              This is the only purpose for which CVs are sent to Google.
            </p>
            <p className="mt-3">
              The extraction is informational only. It does not make any automated decision
              about a candidate. Every hiring decision (advancing, rejecting, hiring) is taken
              by a human recruiter on your team. Article 22 GDPR (automated decision-making with
              legal or similarly significant effect) therefore does not apply to this feature.
            </p>
            <p className="mt-3">
              We use Google&apos;s paid Gemini API, under terms which prohibit Google from using
              customer prompt content to train their models. If the extraction fails or is
              unavailable, the application still proceeds and the recruiter (or candidate) can
              fill in the fields manually.
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
              We retain your account, organization, and candidate data for as long as your
              account is active.
            </p>
            <p className="mt-3">
              After your account is terminated (by you or by us), you have <strong>30 days</strong> to
              request an export of your data. During this 30-day window the data remains
              recoverable. After the 30-day window, your account, organization, and all
              associated candidate data, documents, and application records are permanently
              deleted, except where we are required by law to retain specific records longer
              (for example, invoicing records under Georgian tax law).
            </p>
            <p className="mt-3">
              Within the active life of your account, when you delete a candidate or document
              from within the Service, the record is marked for deletion immediately and
              permanently removed within 30 days. Backup snapshots taken before deletion are
              kept under Supabase&apos;s backup-retention policy and are not used for selective
              restoration of deleted records.
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
            <h2 className="mb-3 text-lg font-semibold">9. Cookies and analytics</h2>
            <p>
              We use cookies and browser storage in two categories:
            </p>

            <h3 className="mb-2 mt-4 font-medium">9.1 Essential</h3>
            <p>
              Cookies and storage required for authentication, session management, CSRF
              protection, and remembering your sign-in preference. These are set by Supabase
              Auth and our own application code, and cannot be disabled without breaking the
              Service. We do not use advertising or cross-site tracking cookies.
            </p>

            <h3 className="mb-2 mt-4 font-medium">9.2 Product analytics</h3>
            <p>
              In production we use the following analytics tools to understand how the Service
              is used and to improve it:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>PostHog</strong> (hosted in the EU, <code>eu.i.posthog.com</code>) —
                captures page views, clicks, and product events. Person profiles are created
                only for signed-in users (configured as <code>identified_only</code>).
                Anonymous visitors to the landing page and public application pages do not
                receive a PostHog person profile.
              </li>
              <li>
                <strong>Vercel Analytics</strong> — counts page views and basic traffic
                signals (referrer, country, device type) on production deployments. Vercel
                Analytics is privacy-friendly and does not use cross-site tracking cookies.
              </li>
            </ul>
            <p className="mt-3">
              We do not run PostHog or Vercel Analytics on the candidate apply pages in a way
              that captures candidate-entered content, and we do not send candidate personal
              data (name, email, CV content) to either tool.
            </p>

            <h3 className="mb-2 mt-4 font-medium">9.3 Error monitoring</h3>
            <p>
              Sentry collects technical error details (stack traces, browser/OS, request
              metadata) when something fails in the Service. Before any error is sent to
              Sentry, we run a server-side scrubbing step that removes known personal-data
              fields (names, emails, phone numbers, CV content, dates of birth, and similar)
              from the payload, so error reports do not contain candidate personal data.
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
