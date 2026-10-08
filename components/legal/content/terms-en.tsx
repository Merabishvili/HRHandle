import Link from 'next/link'
import { ContactBlock, List, Mail, P, Section } from '../parts'
import { BUSINESS_ID } from '@/lib/legal/contact'
import {
  REFUND_LIMIT_MONTHS,
  REFUND_PAYOUT_BUSINESS_DAYS,
  REFUND_REQUEST_DAYS,
  RENEWAL_GRACE_DAYS,
} from '@/lib/legal/documents'

export function TermsEn() {
  return (
    <>
      <Section title="1. Introduction">
        <P first>
          These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of HRHandle
          (&quot;Service&quot;), an applicant tracking system operated by Aleksandre Merabishvili,
          Individual Entrepreneur, identification number {BUSINESS_ID}, Tbilisi, Georgia
          (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
        </P>
        <P>
          By creating an account or using the Service, you agree to be bound by these Terms. If you
          do not agree, do not use the Service.
        </P>
      </Section>

      <Section title="2. Description of Service">
        <P first>
          HRHandle is a cloud-based applicant tracking system that allows organizations to manage job
          vacancies, track candidates through hiring pipelines, evaluate candidates with structured
          criteria, schedule interviews, send offers, and store candidate-related documents and
          notes.
        </P>
        <P>
          The Service includes optional integrations with third-party platforms: Google and Microsoft
          (sign-in and calendar synchronization, including Microsoft Teams meetings), LinkedIn
          (posting vacancies), Zoom (video meetings), Calendly (candidate self-scheduling), and Slack
          and Microsoft Teams (notifications to your team&apos;s channels). It also includes optional
          AI-assisted features (see Section 9). Use of an integration is subject to the terms of the
          respective third-party platform.
        </P>
      </Section>

      <Section title="3. Eligibility">
        <P first>
          You must be at least 18 years old and have the legal authority to enter into a binding
          agreement on behalf of yourself or your organization. By using the Service, you represent
          that you meet these requirements.
        </P>
      </Section>

      <Section title="4. Accounts">
        <P first>
          You are responsible for maintaining the confidentiality of your account credentials and for
          all activity that occurs under your account. You agree to notify us immediately at <Mail />{' '}
          of any unauthorized use of your account.
        </P>
        <P>
          Each organization may have one account. You may invite team members to your organization
          under your subscription. You are responsible for ensuring that all users in your
          organization comply with these Terms.
        </P>
      </Section>

      <Section title="5. Subscriptions and Payment">
        <P first>The Service is offered under the following plans:</P>
        <List>
          <li>
            <strong>Free Trial:</strong> 7 days of full access at no charge. No payment method
            required. Includes up to 5 active vacancies, 100 candidates, and 2 team members.
          </li>
          <li>
            <strong>Individual Plan:</strong> ₾49/month (or ₾39/month billed annually). Includes up
            to 500 active vacancies, 10,000 candidates, and 3 team members.
          </li>
          <li>
            <strong>Organization Plan:</strong> ₾99/month (or ₾79/month billed annually). Includes up
            to 1,000 active vacancies, 20,000 candidates, and 50 team members.
          </li>
        </List>
        <P>
          Prices are shown in your local currency on our pricing page — Georgian Lari (GEL) for
          customers in Georgia, Euro (EUR) in the European Union, and US Dollars (USD) elsewhere. The
          amounts above are the GEL prices; the EUR and USD equivalents are displayed at checkout. An
          owner or admin can change the billing currency on the billing page.
        </P>
        <P>
          <strong>Digital delivery.</strong> HRHandle is a digital software-as-a-service product.
          There are no physical goods to ship. Access to your paid plan is granted immediately and
          automatically once your payment is confirmed, and remains available for the billing period
          you have paid for.
        </P>
        <P>
          Both monthly and annual billing cycles are available for paid plans. Annual billing is
          charged as a single payment at the start of the billing period.
        </P>
        <P>
          Subscriptions renew automatically at the end of each billing period unless cancelled before
          the renewal date. You may cancel your subscription at any time from your account settings;
          after cancelling, you keep access until the end of the billing period you have paid for.
        </P>
        <P>
          <strong>End of the free trial.</strong> When the trial ends and you have not chosen a paid
          plan, access to the Service is paused until you subscribe. Your data is kept in the
          meantime (see Section 13 and our Privacy Policy).
        </P>
        <P>
          <strong>Failed payments.</strong> If a renewal payment fails, you keep access for{' '}
          {RENEWAL_GRACE_DAYS} days after the end of the billing period. If no payment succeeds by
          then, access is paused until you pay again.
        </P>
        <P>
          Payments are processed securely by our payment provider, Flitt. We accept Visa and
          Mastercard, as well as Google Pay and Apple Pay. We do not store your payment card details.
        </P>
      </Section>

      <Section title="6. Refunds">
        <P first>
          Please refer to our{' '}
          <Link href="/refund" className="underline">
            Refund Policy
          </Link>{' '}
          for full details. In summary: a refund may be requested within {REFUND_REQUEST_DAYS} days
          of a payment; each organization can receive at most one refund in any {REFUND_LIMIT_MONTHS}
          -month period; approved refunds are sent within {REFUND_PAYOUT_BUSINESS_DAYS} business days,
          minus payment processing fees, which are non-refundable; and when a refund is issued, the
          paid subscription is cancelled.
        </P>
      </Section>

      <Section title="7. Acceptable Use">
        <P first>You agree not to:</P>
        <List>
          <li>Use the Service for any unlawful purpose or in violation of applicable laws</li>
          <li>Upload or store content that is illegal, defamatory, or infringes third-party rights</li>
          <li>Attempt to gain unauthorized access to the Service or its infrastructure</li>
          <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
          <li>Resell or sublicense the Service without our prior written consent</li>
          <li>
            Use the Service to process candidate data for purposes other than legitimate recruitment
            activities
          </li>
        </List>
      </Section>

      <Section title="8. Candidate Data and Third-Party Integrations">
        <P first>
          The Service allows you to store and manage candidate data, including information that
          candidates submit through your application page, that you import from a spreadsheet, or
          that you copy from LinkedIn. You are responsible for ensuring that you have a lawful basis
          for collecting and processing candidate personal data, and that your use of candidate data
          complies with applicable data protection laws, including the GDPR where applicable.
        </P>
        <P>
          When you use an integration, we act on your behalf and only within the scopes you
          explicitly authorize: vacancy content is shared with LinkedIn when you post a vacancy;
          interview events and meetings are created in your Google or Microsoft calendar, Microsoft
          Teams, or Zoom; Calendly scheduling links are pre-filled with the candidate&apos;s name and
          email address, and bookings are recorded as interviews; and notifications sent to Slack or
          Microsoft Teams channels you configure can include candidate names and vacancy titles.
        </P>
        <P>
          We do not sell candidate data or use it for advertising. We share it only with the service
          providers listed in our Privacy Policy, which process it on our behalf to run the Service,
          and with the third-party services you choose to connect.
        </P>
      </Section>

      <Section title="9. AI-Assisted Features">
        <P first>
          The Service offers optional AI-assisted features, such as CV parsing, job-description
          suggestions, an inclusive-language check, assessment suggestions, and AI Fit Analysis.
          Their output is advisory only: no feature makes, ranks, or automates hiring decisions. You
          are responsible for reviewing AI output and for every decision you take.
        </P>
        <P>
          AI Fit Analysis is off by default; an owner or admin can enable it for the organization.
          Organizations located in the European Union or the European Economic Area must also confirm
          an acknowledgement before enabling it. Our{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{' '}
          describes which data each feature uses.
        </P>
      </Section>

      <Section title="10. Intellectual Property">
        <P first>
          The Service, including its design, code, and branding, is owned by us and protected by
          intellectual property laws. You retain ownership of all data you upload or create through
          the Service.
        </P>
        <P>
          By using the Service, you grant us a limited, non-exclusive licence to store and process
          your data solely for the purpose of providing the Service.
        </P>
      </Section>

      <Section title="11. Availability and Modifications">
        <P first>
          We aim to maintain high availability but do not guarantee uninterrupted access to the
          Service. We reserve the right to modify, suspend, or discontinue the Service or any feature
          at any time, with reasonable notice where possible.
        </P>
      </Section>

      <Section title="12. Limitation of Liability">
        <P first>
          To the maximum extent permitted by applicable law, we shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, including but not limited to loss
          of data, revenue, or business, arising from your use of or inability to use the Service.
        </P>
        <P>
          Our total liability to you for any claims arising from these Terms or your use of the
          Service shall not exceed the amount you paid us in the 3 months preceding the claim.
        </P>
      </Section>

      <Section title="13. Termination">
        <P first>
          We may suspend or terminate your account if you violate these Terms, fail to pay
          subscription fees, or if we are required to do so by law. Upon termination, your right to
          access the Service ceases. You may request an export of your data within 30 days of
          termination by contacting us. After this 30-day window your account, organization, and
          candidate data are permanently deleted as described in our{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          , except where we are required by law to retain specific records longer.
        </P>
      </Section>

      <Section title="14. Governing Law">
        <P first>
          These Terms are governed by the laws of Georgia. Any disputes shall be resolved in the
          courts of Tbilisi, Georgia.
        </P>
      </Section>

      <Section title="15. Changes to These Terms">
        <P first>
          We may update these Terms from time to time. We will notify you of material changes by
          email or via a notice within the Service. Continued use of the Service after the effective
          date of changes constitutes your acceptance of the new Terms.
        </P>
      </Section>

      <Section title="16. Contact">
        <ContactBlock locale="en" />
      </Section>
    </>
  )
}
