import { ContactBlock, List, Mail, P, Section, Sub, Table } from '../parts'
import { BUSINESS_ID } from '@/lib/legal/contact'

export function PrivacyEn() {
  return (
    <>
      <Section title="1. Who We Are">
        <P first>
          HRHandle is operated by Aleksandre Merabishvili, Individual Entrepreneur, identification
          number {BUSINESS_ID}, Tbilisi, Georgia (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
        </P>
        <P>
          We are the data controller for the personal data of our customers (account holders and
          their team members). For candidate data that you enter into the Service, you are the data
          controller and we act as a data processor on your behalf.
        </P>
        <P>
          Contact: <Mail />
        </P>
      </Section>

      <Section title="2. What Data We Collect">
        <Sub>2.1 Account and Organization Data</Sub>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name and email address of account holders and team members</li>
          <li>Organization name, country, and configuration settings</li>
          <li>Usage activity within the Service (e.g. actions taken, features used)</li>
          <li>
            If you sign in with Google or Microsoft: your account name, email address, and profile
            picture, provided via OAuth. We never receive your Google or Microsoft password.
          </li>
          <li>
            Billing records: your plan, billing cycle, amounts, currency, payment status, and the
            order and payment identifiers from our payment provider, Flitt. Flitt processes your
            card or wallet details; we never receive or store full card numbers.
          </li>
          <li>
            Support requests: when you contact us by email or through our support form, your name,
            email address, and message.
          </li>
        </ul>

        <Sub>2.2 Integration Data</Sub>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            If you connect LinkedIn: your LinkedIn OAuth access token, used solely to post vacancies
            on your behalf. We do not access your LinkedIn connections or personal feed.
          </li>
          <li>
            If you connect Google Calendar: your Google OAuth access and refresh tokens, used solely
            to create and manage interview calendar events on your behalf.
          </li>
          <li>
            If you connect Zoom: your Zoom OAuth access and refresh tokens, used solely to create
            Zoom meetings when scheduling video interviews on your behalf.
          </li>
          <li>
            If you connect Microsoft: your Microsoft OAuth access and refresh tokens, used solely to
            create Teams meetings and Outlook Calendar events when scheduling interviews on your
            behalf. We do not access your emails, contacts, or any other Microsoft data.
          </li>
          <li>
            If you connect Calendly: your Calendly OAuth tokens and a webhook signing key, used to
            list your event types, build scheduling links for candidates, and record the interviews
            candidates book.
          </li>
          <li>
            If your admins add Slack or Microsoft Teams notifications: the incoming-webhook addresses
            they enter, used to post notifications to the channels they choose.
          </li>
        </ul>

        <Sub>2.3 Vacancy Data</Sub>
        <ul className="list-disc space-y-1 pl-5">
          <li>Job titles, descriptions, responsibilities, departments, locations, and requirements</li>
          <li>Salary information and hiring timelines</li>
          <li>Evaluation criteria and scores entered by your team</li>
        </ul>

        <Sub>2.4 Candidate Data</Sub>
        <p className="mb-2">
          You enter candidate data into HRHandle as part of your recruitment process, or candidates
          submit it themselves through your public application page. This may include:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Full name, email address, and phone number</li>
          <li>Current company and position, years of experience</li>
          <li>LinkedIn profile URL</li>
          <li>CVs, resumes, cover letters, and other uploaded documents</li>
          <li>
            Information extracted from uploaded CVs (work experience, education) — see Section 5.1
          </li>
          <li>Recruiter notes, evaluations, interview records, and offers</li>
          <li>Application status and history</li>
          <li>
            For candidates who apply through the public application page: the IP address from which
            the application was submitted. We use it to prevent abuse (rate limiting and
            duplicate-submission detection). It is stored with the application record and deleted
            together with it.
          </li>
        </ul>
        <P>
          Some of this data may be copied by your recruiters from LinkedIn, or bulk-imported from a
          CSV or Excel file by an organization owner or admin. You are responsible for ensuring you
          have a lawful basis to collect and store this data under applicable law, regardless of how
          it was entered.
        </P>

        <Sub>2.5 Candidate-facing pages and emails</Sub>
        <p className="mb-2">
          When a candidate applies for a role, we create a private status page at{' '}
          <span className="font-mono text-sm">/status/&lt;token&gt;</span> that shows only that
          candidate&apos;s own application. The token is a random 32-character string and is the
          only credential — there is no login. The page shows the role title, the employer&apos;s
          name, the application date, the date of the last status change, and a simplified status
          (Applied / In review / Interview / Decision / Closed). It does <strong>not</strong> show
          recruiter notes, evaluation scores, internal pipeline stages, or any other internal data.
          The candidate can also withdraw the application from this page, with an optional reason
          that only the recruiter sees; any active offer is then withdrawn as well. The link stops
          working when the application is removed.
        </p>
        <P>
          When a recruiter sends an offer, a separate private offer page at{' '}
          <span className="font-mono text-sm">/offer/&lt;token&gt;</span> shows the role title,
          employer name, the offer terms the recruiter entered, and an optional personal note. The
          candidate can accept or decline there; a decline reason, if given, is visible only to the
          recruiter.
        </P>
        <P>
          When a recruiter shares a candidate&apos;s evaluation with someone outside HRHandle, a
          private page at <span className="font-mono text-sm">/scorecard/&lt;token&gt;</span> shows
          only the candidate&apos;s name, the role, the organization&apos;s name, the evaluation
          answers and scores, and who shared it and when. It does <strong>not</strong> show contact
          details, application status, notes, AI-generated content, or offer terms. The recruiter
          can revoke the link at any time.
        </P>
        <P>
          On your behalf, HRHandle can send these emails to candidates: an application confirmation
          (with the status-page link); optional status-change emails when an application moves to
          &quot;Under review&quot; or &quot;Interview&quot; (off by default, enabled by an admin);
          and interview invitations, offers, and rejection emails, which are sent only when a
          recruiter chooses to send them.
        </P>
      </Section>

      <Section title="3. How We Use Your Data">
        <ul className="list-disc space-y-1 pl-5">
          <li>To provide, operate, and improve the Service</li>
          <li>To manage your subscription and process payments (through Flitt)</li>
          <li>
            To send emails: account invitations and password resets, notifications to your team, the
            candidate emails described in Section 2.5, and replies to support requests
          </li>
          <li>
            To protect the Service from abuse: bot protection (Cloudflare Turnstile) on sign-in,
            sign-up, password, application, and support forms, and rate limiting
          </li>
          <li>To monitor for errors and technical issues (via Sentry)</li>
          <li>To comply with legal obligations</li>
        </ul>
        <P>
          We do not use your data or your candidates&apos; data for advertising or marketing
          purposes, and we do not sell data to third parties.
        </P>
      </Section>

      <Section title="4. Legal Basis for Processing">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Contract performance:</strong> processing necessary to deliver the Service under
            our Terms
          </li>
          <li>
            <strong>Legitimate interests:</strong> keeping the Service secure and reliable,
            preventing abuse and fraud, and monitoring service health
          </li>
          <li>
            <strong>Legal obligation:</strong> complying with applicable laws, including accounting
            and tax rules
          </li>
          <li>
            <strong>Consent:</strong> where you have explicitly provided it
          </li>
        </ul>
      </Section>

      <Section title="5. Service Providers (Sub-processors)">
        <P first>We use the following providers to run the Service:</P>
        <Table
          head={['Provider', 'Purpose', 'Location']}
          rows={[
            ['Supabase (AWS us-east-1)', 'Database, authentication, and file storage', 'USA'],
            ['Vercel', 'Hosting, deployment, and privacy-friendly traffic analytics', 'USA / Global CDN'],
            ['Resend', 'Email delivery', 'USA'],
            ['Sentry', 'Error monitoring (personal data removed before sending)', 'USA'],
            ['PostHog', 'Product analytics', 'EU'],
            ['Cloudflare (Turnstile)', 'Bot protection on sign-in, sign-up, password, application, and support forms', 'USA / Global'],
            ['Flitt', 'Payment processing (cards, Google Pay, Apple Pay)', 'Georgia'],
            ['Google (Gemini API)', 'AI-assisted features — see Section 5.1', 'USA / Global'],
            ['ImprovMX and Google (Gmail)', 'Receiving and handling support emails', 'USA / Global'],
            ['Google (optional)', 'Sign-in and Google Calendar', 'USA / Global'],
            ['Microsoft (optional)', 'Sign-in, Outlook Calendar, Teams meetings, and Teams notifications', 'USA / Global'],
            ['LinkedIn (optional)', 'Vacancy posting', 'USA / Global'],
            ['Zoom (optional)', 'Video meetings', 'USA / Global'],
            ['Calendly (optional)', 'Candidate interview self-scheduling', 'USA'],
            ['Slack (optional)', 'Notifications to your Slack channels', 'USA / Global'],
          ]}
        />
        <P>
          Providers marked &quot;optional&quot; are used only if your organization connects them.
          All providers are contractually obligated to process data only as instructed and to
          maintain appropriate security measures.
        </P>

        <Sub>5.1 AI-assisted features</Sub>
        <P first>
          Some features send data to Google&apos;s Gemini API to help recruiters — never to replace
          their judgement. CV parsing runs when a CV is uploaded; every other feature runs only when
          a recruiter clicks its button.
        </P>
        <List>
          <li>
            <strong>CV parsing</strong> — when a CV (PDF or Word) is uploaded by a recruiter, or by a
            candidate on your application page, we extract its text on our server and send the text
            to Gemini to pull out structured fields (name, contact details, work experience,
            education) that pre-fill the form.
          </li>
          <li>
            <strong>Job-description suggestions</strong> — suggests the &quot;About the job&quot;,
            &quot;Responsibilities&quot;, or &quot;Requirements&quot; section from the role data the
            recruiter entered. No candidate data is sent. Nothing is added to the vacancy unless the
            recruiter applies it.
          </li>
          <li>
            <strong>Inclusive-language check</strong> — scans the vacancy text for phrasing that may
            deter some candidates and suggests neutral wording. Only vacancy text is sent; the
            recruiter decides whether to apply any suggestion.
          </li>
          <li>
            <strong>Assessment suggestions</strong> — proposes evaluation criteria and open-ended
            questions from the vacancy text. Only vacancy text is sent; each suggestion is added only
            when the recruiter clicks &quot;Add&quot;.
          </li>
          <li>
            <strong>AI Fit Analysis</strong> — off by default; an owner or admin enables it for the
            organization (organizations in the EU/EEA must also confirm an acknowledgement). When a
            recruiter runs it, we send the vacancy&apos;s criteria and only job-relevant parts of the
            application — experience, education, languages, years of experience, and screening
            answers, plus an optional CV excerpt with the candidate&apos;s name, email addresses,
            phone numbers, and links removed. Identity data (name, photo, age, gender, nationality,
            ethnicity, marital status, address, health, religion) is never sent. The result — how
            well the application matches each criterion, with supporting evidence, and no overall
            score — is saved with the candidate&apos;s record for your team to review.
          </li>
        </List>
        <P>
          AI output is informational only. No AI feature in HRHandle makes an automated decision
          about a candidate — no automatic ranking, rejection, or advancement. Every hiring decision
          is taken by a person on your team, so Article 22 GDPR (automated decision-making with legal
          or similarly significant effect) does not apply.
        </P>
        <P>
          We record an internal log entry each time an AI feature is used (who, which feature, when)
          for traceability under the EU AI Act. This log does not contain the AI output.
        </P>
        <P>
          We use Google&apos;s paid Gemini API. Under Google&apos;s paid-services terms, Google may
          not use your prompts or responses to train or improve its models; it retains them briefly
          only for abuse detection. If an AI feature is unavailable, the recruiter simply completes
          the task manually.
        </P>
      </Section>

      <Section title="6. International Data Transfers">
        <P first>
          Your data is stored on servers in the United States (AWS us-east-1, North Virginia), and
          some providers listed above process data in other countries. If you are located in the
          European Economic Area or Georgia, this involves a transfer of personal data outside your
          jurisdiction. We rely on standard contractual clauses and our providers&apos; data
          processing agreements to ensure an adequate level of protection.
        </P>
      </Section>

      <Section title="7. Data Retention">
        <P first>
          We retain your account, organization, and candidate data for as long as your account is
          active.
        </P>
        <P>
          After your account is terminated (by you or by us), you have <strong>30 days</strong> to
          request an export of your data. During this window the data remains recoverable. After it,
          your account, organization, and all associated candidate data, documents, and application
          records are permanently deleted, except where we are required by law to keep specific
          records longer (for example, payment and invoicing records under Georgian tax law).
        </P>
        <P>
          While your account is active, a candidate or document you delete is marked for deletion
          immediately and permanently removed within 30 days. Backup snapshots taken before deletion
          are kept under Supabase&apos;s backup-retention policy and are not used to restore
          individual deleted records.
        </P>
      </Section>

      <Section title="8. Your Rights">
        <P first>Depending on your jurisdiction, you may have the right to:</P>
        <List>
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data (&quot;right to be forgotten&quot;)</li>
          <li>Object to or restrict certain processing</li>
          <li>Receive your data in a portable format</li>
          <li>Withdraw consent where processing is based on consent</li>
        </List>
        <P>
          To exercise any of these rights, contact us at <Mail />. We will respond within 30 days.
          Candidates whose data was entered by an employer should contact that employer first, as it
          is the data controller.
        </P>
      </Section>

      <Section title="9. Cookies and Analytics">
        <P first>We use cookies and browser storage in three categories:</P>
        <Sub>9.1 Essential</Sub>
        <P first>
          Required for sign-in, sessions, security (CSRF and bot protection), and remembering your
          preferences, such as staying signed in and your interface language. They are set by
          Supabase Auth and our own code, and cannot be disabled without breaking the Service; the
          Cloudflare Turnstile security check also processes technical browser data. We do not use
          advertising or cross-site tracking cookies.
        </P>
        <Sub>9.2 Product analytics</Sub>
        <List>
          <li>
            <strong>PostHog</strong> (hosted in the EU) — records page views, clicks, and product
            events. Person profiles are created only for signed-in users; anonymous visitors to the
            landing page and application pages do not get one.
          </li>
          <li>
            <strong>Vercel Analytics</strong> — counts page views and basic traffic signals
            (referrer, country, device type) without cross-site tracking cookies.
          </li>
        </List>
        <P>
          We do not send candidate personal data (name, email, CV content) to either analytics tool.
        </P>
        <Sub>9.3 Error monitoring</Sub>
        <P first>
          Sentry collects technical error details (stack traces, browser and OS, request metadata)
          when something fails. Before an error is sent, we remove known personal-data fields (names,
          emails, phone numbers, CV content, and similar), so error reports do not contain candidate
          personal data.
        </P>
      </Section>

      <Section title="10. Security">
        <P first>
          We implement appropriate technical and organizational measures to protect your data,
          including encrypted transmission (TLS), row-level security on all database tables,
          role-based access controls, bot protection, and signed URLs for document access.
        </P>
      </Section>

      <Section title="11. Children">
        <P first>
          The Service is not directed at persons under 18. We do not knowingly collect personal data
          from anyone under 18.
        </P>
      </Section>

      <Section title="12. Changes to This Policy">
        <P first>
          We may update this Privacy Policy from time to time. We will notify you of material
          changes by email or via a notice within the Service. The &quot;last updated&quot; date at
          the top of this page shows the most recent revision.
        </P>
      </Section>

      <Section title="13. Contact">
        <ContactBlock locale="en" controller />
      </Section>
    </>
  )
}
