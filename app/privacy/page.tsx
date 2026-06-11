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

            <h3 className="mb-2 mt-4 font-medium">2.5 Candidate status page</h3>
            <p className="mb-2">
              When a candidate applies for a role, we create a private, token-gated status page
              at <span className="font-mono text-sm">/status/&lt;token&gt;</span> on this Service
              that shows only that candidate&apos;s own application status. The token is an
              opaque 32-character random string and is the only credential to the page — there
              is no login. The page does <strong>not</strong> show recruiter notes, evaluation
              scores, internal pipeline stage names, or any other recruiter-internal data; it
              shows the role title, employer (the recruiting organisation&apos;s name), the date
              the candidate applied, the date of the last status change, and a simplified
              status bucket (Applied / In review / Interview / Decision / Closed). Candidates
              receive the link in the application-confirmation email; recruiters can also
              re-share it from inside HRHandle. The link can be revoked by the recruiter at
              any time by removing the application; the token is also deleted by our 30-day
              purge ([G-003](https://github.com/Merabishvili/HRHandle/blob/main/docs/issues-found.md))
              if the application is soft-deleted.
            </p>
            <p className="mt-2">
              In addition, recruiters can opt their organisation in to two automatic
              status-change emails: one when an application moves to the &quot;Under review&quot;
              stage and one when it moves to the &quot;Interview&quot; stage. Each email
              contains the role title, employer, and the candidate&apos;s status page link.
              These emails are off by default and only fire when an admin saves a template
              and toggles them on in HRHandle&apos;s settings; no other status transitions
              produce automatic emails (offers, hires, rejections, and withdrawals are
              handled by the recruiter directly).
            </p>
            <p className="mt-2">
              When the recruiter sends an offer, we create a separate token-gated offer
              page at <span className="font-mono text-sm">/offer/&lt;token&gt;</span> on
              this Service. Like the status page, the token is the only credential — there
              is no login. The page shows the role title, employer name, the structured
              terms the recruiter entered (compensation, currency, period, start date,
              respond-by date — any of which may be blank), the recruiter&apos;s
              plain-text offer details, and an optional personal note. The candidate can
              accept or decline directly from the page; declining accepts an optional free-
              text reason which only the recruiter sees. The offer page does not show any
              other candidate&apos;s data and does not show recruiter-internal notes,
              evaluation scores, or audit trail.
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

            <h3 className="mb-2 mt-4 font-medium">5.1 AI-assisted features</h3>
            <p>
              HRHandle includes a small number of AI-assisted features that send candidate or
              vacancy data to Google&apos;s Gemini API to help the recruiter — never to replace
              their judgement. Each feature is opt-in per request: nothing is generated
              automatically, and the recruiter must explicitly click a button to invoke it.
            </p>
            <p className="mt-3">
              Current AI-assisted features:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>CV parsing</strong> — when a CV (PDF or Word document) is uploaded, the
                file is sent to Gemini to extract structured fields (name, contact details, work
                experience, education) so they can be pre-filled into the application form.
              </li>
              <li>
                <strong>Candidate summary</strong> — when a recruiter clicks the
                &quot;Generate summary&quot; button on a candidate record, a short factual
                summary of the candidate&apos;s public/professional background is generated and
                displayed to the recruiter. The summary is not saved to the candidate record
                unless the recruiter chooses to save it as a note.
              </li>
              <li>
                <strong>Job-description suggestions</strong> — when a recruiter clicks
                a &quot;Generate&quot; button while creating or editing a vacancy, the AI
                suggests one or more sections (About the job, Responsibilities,
                Requirements) based on the recruiter-provided role data (title, department,
                location, employment type, sector, and any optional context the recruiter
                typed). No candidate data is sent to the AI for this feature. The suggestions
                are not added to the vacancy unless the recruiter explicitly clicks
                &quot;Apply all to form&quot; or copies a section manually.
              </li>
              <li>
                <strong>Interview question suggestions</strong> — when a recruiter clicks
                the &quot;Generate questions&quot; button on a vacancy&apos;s Interview
                Questions tab, the AI suggests four categories of questions (behavioural,
                technical, situational, closing) based on the vacancy fields (title,
                description, responsibilities, requirements, department, location,
                employment type, sector, and any optional context the recruiter typed).
                No candidate data is sent to the AI for this feature. The suggestions are
                advisory; the recruiter chooses whether to save them to the vacancy
                (overwriting the previously-saved set) or copy individual questions.
              </li>
              <li>
                <strong>Interview-note structuring</strong> — when a recruiter pastes their
                free-text interview notes and clicks &quot;Extract structure&quot; on the
                candidate detail page, the AI returns a structured view (summary,
                strengths, concerns, skills demonstrated, follow-ups). The notes the
                recruiter pasted are sent to Google&apos;s Gemini API along with the
                candidate&apos;s name and the title of the role they are being considered
                for. The AI is explicitly instructed not to make any hiring
                recommendation, not to include the candidate&apos;s salary expectations
                in the structured output, and not to infer protected characteristics
                (age, gender, race, religion, family or marital status, disability, etc.)
                even if the notes hint at them. The structured output is not saved
                anywhere unless the recruiter clicks &quot;Save as note&quot;, which
                creates a single candidate note prefixed with &quot;AI interview notes
                (not reviewed by recruiter)&quot; so it is clearly traceable.
              </li>
              <li>
                <strong>Inclusive-language check</strong> — when a recruiter clicks
                &quot;Run check&quot; on a vacancy form, the AI scans the vacancy&apos;s
                description, responsibilities, and requirements fields for phrases that
                may deter underrepresented candidates (gender-coded, age-coded,
                culture-coded, pronoun bias, potentially discriminatory phrasing,
                vague cultural-fit requirements). It returns a list of flagged
                passages with the reason and a suggested neutral replacement. Only the
                vacancy text is sent to the AI for this feature; no candidate data is
                involved. The form is never modified by the AI; the recruiter chooses
                whether to apply any of the suggestions.
              </li>
              <li>
                <strong>Assessment suggester</strong> — when a recruiter clicks
                &quot;Generate suggestions&quot; on a vacancy&apos;s Assessment tab,
                the AI proposes evaluation criteria (skill labels scored 1–10) and
                open-ended prompts based on the vacancy&apos;s text. Only the vacancy
                text is sent to the AI for this feature; no candidate data is
                involved. Each suggestion is added to the vacancy only when the
                recruiter explicitly clicks the &quot;Add&quot; button next to it.
              </li>
              <li>
                <strong>Email drafter</strong> — when a recruiter opens the AI email
                drafter on a candidate&apos;s page and clicks &quot;Draft email&quot;
                (or &quot;Improve draft&quot;), the AI returns a subject line and a
                plain-text body for the recruiter to review and edit. The
                candidate&apos;s first name, the role title (if a specific role is
                selected), the recruiter&apos;s first name, the recruiter&apos;s
                free-text notes, and — in &quot;improve&quot; mode — the
                recruiter&apos;s own draft are sent to Google&apos;s Gemini API. The
                candidate&apos;s email address, phone number, LinkedIn URL, last name,
                date of birth, application history, and evaluation history are
                <em>not</em> sent. No email is ever sent automatically: the drafter
                returns text only, and the recruiter copies it into their own email
                tool to send.
              </li>
            </ul>
            <p className="mt-3">
              The AI output is informational only. No AI feature in HRHandle makes any automated
              decision about a candidate — no automatic ranking, no automatic rejection, no
              automatic advancement. Every hiring decision (advancing, rejecting, hiring) is
              taken by a human recruiter on your team. Article 22 GDPR (automated decision-making
              with legal or similarly significant effect) therefore does not apply.
            </p>
            <p className="mt-3">
              We record an internal log entry each time an AI feature is invoked (recruiter,
              candidate, feature name, timestamp) for traceability under the EU AI Act&apos;s
              high-risk-AI logging requirements. We do not log the AI output itself.
            </p>
            <p className="mt-3">
              We use Google&apos;s paid Gemini API for all of these features. Under Google&apos;s
              paid-services terms, Google is not permitted to use customer prompt content or
              responses to train or improve their models. Google retains prompts and responses
              briefly only for abuse detection.
            </p>
            <p className="mt-3">
              If an AI feature is unavailable or fails for any reason, the workflow proceeds
              normally and the recruiter completes the task manually.
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
