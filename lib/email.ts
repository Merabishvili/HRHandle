import { Resend } from 'resend'
import { applyVariables, escapeHtml, defaultTemplate } from '@/lib/email-template-utils'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  return new Resend(key)
}

const FROM = 'HRHandle <noreply@hrhandle.com>'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

function senderFrom(senderName: string) {
  const safe = senderName.replace(/["\r\n]/g, '').trim()
  return `${safe} <noreply@hrhandle.com>`
}

/** Localized copy for the team-invite email. Language is the inviter's org
 * content locale (the invitee has no account/locale yet). `intro` carries
 * `{inviter}` / `{org}` / `{role}` tokens filled in with bold, HTML-escaped
 * values at render time. */
const INVITE_STRINGS: Record<
  Locale,
  {
    subject: (inviter: string, org: string) => string
    heading: string
    intro: string
    accept: string
    expiry: string
    copyLabel: string
    roleAdmin: string
    roleMember: string
  }
> = {
  en: {
    subject: (inviter, org) => `${inviter} invited you to join ${org} on HRHandle`,
    heading: "You've been invited",
    intro: '{inviter} has invited you to join {org} as a {role}.',
    accept: 'Accept Invitation',
    expiry: "This invitation expires in 7 days. If you weren't expecting this, you can ignore it.",
    copyLabel: 'Or copy this link:',
    roleAdmin: 'Admin',
    roleMember: 'Member',
  },
  ka: {
    subject: (inviter, org) => `${inviter}-მ მოგიწვიათ ${org}-ის გუნდში HRHandle-ზე`,
    heading: 'თქვენ მიწვეული ხართ',
    intro: '{inviter}-მ მოგიწვიათ {org}-ის გუნდში, როგორც {role}.',
    accept: 'მოწვევის მიღება',
    expiry: 'მოწვევა იწურება 7 დღეში. თუ ამას არ ელოდით, შეგიძლიათ უგულებელყოთ.',
    copyLabel: 'ან დააკოპირეთ ეს ბმული:',
    roleAdmin: 'ადმინისტრატორი',
    roleMember: 'წევრი',
  },
  ru: {
    subject: (inviter, org) => `${inviter} приглашает вас в ${org} на HRHandle`,
    heading: 'Вас пригласили',
    intro: '{inviter} пригласил(а) вас присоединиться к {org} в роли {role}.',
    accept: 'Принять приглашение',
    expiry: 'Приглашение истекает через 7 дней. Если вы этого не ожидали, можете проигнорировать письмо.',
    copyLabel: 'Или скопируйте эту ссылку:',
    roleAdmin: 'Администратор',
    roleMember: 'Участник',
  },
}

/** Pure builder for the team-invite email (subject + HTML), extracted so the
 * localization is unit-testable without hitting Resend. */
export function buildTeamInviteEmail({
  inviterName,
  organizationName,
  role,
  joinUrl,
  locale,
}: {
  inviterName: string
  organizationName: string
  role: string
  joinUrl: string
  locale?: Locale | undefined
}): { subject: string; html: string } {
  const s = INVITE_STRINGS[locale ?? DEFAULT_LOCALE] ?? INVITE_STRINGS[DEFAULT_LOCALE]
  const roleLabel = role === 'admin' ? s.roleAdmin : s.roleMember
  const safeInviter = escapeHtml(inviterName)
  const safeOrg = escapeHtml(organizationName)
  // Function replacers so a `$`-containing org/inviter name can't trigger
  // String.replace's special `$&`/`$'` substitution patterns.
  const introHtml = s.intro
    .replace('{inviter}', () => `<strong style="color: #111827;">${safeInviter}</strong>`)
    .replace('{org}', () => `<strong style="color: #111827;">${safeOrg}</strong>`)
    .replace('{role}', () => `<strong style="color: #111827;">${roleLabel}</strong>`)

  return {
    subject: s.subject(inviterName, organizationName),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 40px;">
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">${s.heading}</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">${introHtml}</p>
    <a href="${joinUrl}"
       style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none;
              padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
      ${s.accept}
    </a>
    <p style="color: #9ca3af; font-size: 13px; margin: 24px 0 0;">${s.expiry}</p>
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      ${s.copyLabel} <span style="color: #6b7280;">${joinUrl}</span>
    </p>
  </div>
</body>
</html>`,
  }
}

export async function sendTeamInviteEmail({
  to,
  inviterName,
  organizationName,
  role,
  token,
  contentLocale,
}: {
  to: string
  inviterName: string
  organizationName: string
  role: string
  token: string
  contentLocale?: Locale
}) {
  const joinUrl = `${BASE_URL}/join?token=${encodeURIComponent(token)}`
  const { subject, html } = buildTeamInviteEmail({
    inviterName,
    organizationName,
    role,
    joinUrl,
    locale: contentLocale,
  })

  return getResend().emails.send({ from: FROM, to, subject, html })
}

export async function sendInterviewInvitationEmail({
  to,
  candidateName,
  senderName,
  senderEmail,
  vacancyTitle,
  organizationName,
  scheduledAt,
  durationMinutes,
  interviewType,
  meetingLink,
  customSubject,
  customBody,
  contentLocale,
  rescheduled = false,
  timezone,
}: {
  to: string
  candidateName: string
  senderName: string
  senderEmail: string
  vacancyTitle: string
  organizationName?: string | undefined
  scheduledAt: string
  durationMinutes: number
  interviewType: 'video' | 'phone' | 'onsite'
  meetingLink: string | null
  customSubject?: string | undefined
  customBody?: string | undefined
  contentLocale?: Locale | undefined
  rescheduled?: boolean
  timezone?: string | undefined
}) {
  const tz = timezone || 'UTC'
  const d = new Date(scheduledAt)
  const date = d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })
  const typeLabel = interviewType === 'video' ? 'Video Call' : interviewType === 'phone' ? 'Phone Call' : 'On-site'
  const safeCandidate = escapeHtml(candidateName)
  const safeSenderName = escapeHtml(senderName)
  const safeSenderEmail = escapeHtml(senderEmail)
  const safeMeetingLink = meetingLink && meetingLink.startsWith('https://') ? meetingLink : null

  const vars = {
    candidate_name: candidateName,
    role: vacancyTitle,
    company: organizationName ?? senderName,
    interview_date: date,
    interview_time: time,
    meeting_link: meetingLink ?? '',
    interviewer_name: senderName,
  }
  const defaults = defaultTemplate('interview_invitation', contentLocale ?? DEFAULT_LOCALE)
  const subject = rescheduled
    ? `Interview Rescheduled: ${vacancyTitle}`
    : applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)
  const headingText = rescheduled ? 'Interview Rescheduled' : 'Interview Invitation'

  const meetingRow = safeMeetingLink
    ? `<tr>
        <td style="padding: 6px 0; color: #6b7280; width: 130px;">Meeting link</td>
        <td style="padding: 6px 0;">
          <a href="${safeMeetingLink}" style="color: #111827; font-weight: 600;">${escapeHtml(safeMeetingLink)}</a>
        </td>
      </tr>`
    : ''

  return getResend().emails.send({
    from: senderFrom(senderName),
    to,
    replyTo: senderEmail,
    subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 40px;">
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">${headingText}</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      Dear <strong style="color: #111827;">${safeCandidate}</strong>,<br><br>
      ${body}
    </p>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 6px 0; color: #6b7280; width: 130px;">Date</td>
        <td style="padding: 6px 0; font-weight: 600; color: #111827;">${date}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #6b7280;">Time</td>
        <td style="padding: 6px 0; font-weight: 600; color: #111827;">${time}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #6b7280;">Duration</td>
        <td style="padding: 6px 0; color: #111827;">${durationMinutes} minutes</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #6b7280;">Format</td>
        <td style="padding: 6px 0; color: #111827;">${typeLabel}</td>
      </tr>
      ${meetingRow}
    </table>

    ${safeMeetingLink ? `
    <a href="${safeMeetingLink}"
       style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none;
              padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-bottom: 24px;">
      Join Meeting
    </a>` : ''}

    <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0;">
      If you have any questions, please reply to this email or contact
      <strong style="color: #111827;">${safeSenderName}</strong> at
      <a href="mailto:${safeSenderEmail}" style="color: #111827;">${safeSenderEmail}</a>.
    </p>
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sent via HRHandle</p>
  </div>
</body>
</html>`,
  })
}

export async function sendApplicationConfirmationEmail({
  to,
  candidateName,
  vacancyTitle,
  organizationName,
  customSubject,
  customBody,
  contentLocale,
  statusUrl,
}: {
  to: string
  candidateName: string
  vacancyTitle: string
  organizationName: string
  customSubject?: string
  customBody?: string
  contentLocale?: Locale
  /** Public candidate-facing status URL (G-016). When provided, rendered as a
   * CTA button under the body. Omitting it keeps the legacy template intact. */
  statusUrl?: string
}) {
  const vars = {
    candidate_name: candidateName,
    role: vacancyTitle,
    company: organizationName,
    status_url: statusUrl ?? '',
  }
  const defaults = defaultTemplate('application_received', contentLocale ?? DEFAULT_LOCALE)
  const subject = applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)
  const safeCandidate = escapeHtml(candidateName)
  const safeStatusUrl = statusUrl ? escapeHtml(statusUrl) : null

  const statusCta = safeStatusUrl
    ? `
    <p style="margin: 0 0 24px;">
      <a href="${safeStatusUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 16px; border-radius: 6px;">Track your application</a>
    </p>
    <p style="color: #9ca3af; font-size: 12px; margin: 0 0 16px;">
      Keep this link private — it's the only way to view your status without contacting the recruiter.
    </p>`
    : ''

  return getResend().emails.send({
    from: FROM,
    to,
    subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 40px;">
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">Thanks for Applying!</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      Dear <strong style="color: #111827;">${safeCandidate}</strong>,<br><br>
      ${body}
    </p>
    ${statusCta}
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sent via HRHandle · Please do not reply to this email.</p>
  </div>
</body>
</html>`,
  })
}

export type StatusChangeStage = 'screening' | 'interview'

/** Auto-email fired by `updateApplicationStatus` when an application moves to
 * the screening or interview stage and the org has opted in. Body falls back
 * to the stage's default template if no custom body is set. Status URL is
 * always appended as a CTA so the candidate has a place to come back to. */
export async function sendApplicationStatusChangedEmail({
  to,
  candidateName,
  vacancyTitle,
  organizationName,
  stage,
  statusUrl,
  customSubject,
  customBody,
  contentLocale,
}: {
  to: string
  candidateName: string
  vacancyTitle: string
  organizationName: string
  stage: StatusChangeStage
  statusUrl?: string | undefined
  customSubject?: string | undefined
  customBody?: string | undefined
  contentLocale?: Locale | undefined
}) {
  const vars = {
    candidate_name: candidateName,
    role: vacancyTitle,
    company: organizationName,
    status_url: statusUrl ?? '',
  }
  const defaults =
    stage === 'screening'
      ? defaultTemplate('status_change_screening', contentLocale ?? DEFAULT_LOCALE)
      : defaultTemplate('status_change_interview', contentLocale ?? DEFAULT_LOCALE)
  const subject = applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)
  const safeCandidate = escapeHtml(candidateName)
  const safeStatusUrl = statusUrl ? escapeHtml(statusUrl) : null

  const heading = stage === 'screening' ? 'Your application is under review' : 'Moving to the interview stage'

  const statusCta = safeStatusUrl
    ? `
    <p style="margin: 0 0 16px;">
      <a href="${safeStatusUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 16px; border-radius: 6px;">Track your application</a>
    </p>`
    : ''

  return getResend().emails.send({
    from: FROM,
    to,
    subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 40px;">
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">${heading}</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      Dear <strong style="color: #111827;">${safeCandidate}</strong>,<br><br>
      ${body}
    </p>
    ${statusCta}
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sent via HRHandle · Please do not reply to this email.</p>
  </div>
</body>
</html>`,
  })
}

/** Auto-email fired by `sendOffer` when the recruiter transitions an offer
 * from draft → sent. The body is intentionally generic — the offer page at
 * `offerUrl` shows the structured details (compensation, dates) and the
 * full markdown body. This email is purely the doorbell. */
export async function sendOfferEmail({
  to,
  candidateName,
  vacancyTitle,
  organizationName,
  offerUrl,
  customSubject,
  customBody,
  contentLocale,
}: {
  to: string
  candidateName: string
  vacancyTitle: string
  organizationName: string
  offerUrl: string
  customSubject?: string
  customBody?: string
  contentLocale?: Locale
}) {
  const vars = {
    candidate_name: candidateName,
    role: vacancyTitle,
    company: organizationName,
    offer_url: offerUrl,
  }
  const defaults = defaultTemplate('offer_sent', contentLocale ?? DEFAULT_LOCALE)
  const subject = applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)
  const safeCandidate = escapeHtml(candidateName)
  const safeOfferUrl = escapeHtml(offerUrl)

  return getResend().emails.send({
    from: FROM,
    to,
    subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 40px;">
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">You have an offer</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      Dear <strong style="color: #111827;">${safeCandidate}</strong>,<br><br>
      ${body}
    </p>
    <p style="margin: 0 0 16px;">
      <a href="${safeOfferUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 16px; border-radius: 6px;">View your offer</a>
    </p>
    <p style="color: #9ca3af; font-size: 12px; margin: 0 0 16px;">
      Keep this link private — it's the only way to view and respond to this offer.
    </p>
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sent via HRHandle · Please do not reply to this email.</p>
  </div>
</body>
</html>`,
  })
}

export async function sendApplicationRejectionEmail({
  to,
  candidateName,
  vacancyTitle,
  organizationName,
  senderName,
  senderEmail,
  customSubject,
  customBody,
  contentLocale,
}: {
  to: string
  candidateName: string
  vacancyTitle: string
  organizationName: string
  senderName: string
  senderEmail: string
  customSubject?: string | undefined
  customBody?: string | undefined
  contentLocale?: Locale | undefined
}) {
  const vars = { candidate_name: candidateName, role: vacancyTitle, company: organizationName }
  const defaults = defaultTemplate('rejection', contentLocale ?? DEFAULT_LOCALE)
  const subject = applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)
  const safeCandidate = escapeHtml(candidateName)
  const safeSenderName = escapeHtml(senderName)
  const safeSenderEmail = escapeHtml(senderEmail)

  return getResend().emails.send({
    from: senderFrom(senderName),
    to,
    replyTo: senderEmail,
    subject,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 40px;">
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">Hiring Update</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      Dear <strong style="color: #111827;">${safeCandidate}</strong>,<br><br>
      ${body}
    </p>
    <p style="color: #6b7280; font-size: 13px; margin: 0;">
      If you have any questions, you are welcome to contact
      <strong style="color: #111827;">${safeSenderName}</strong> at
      <a href="mailto:${safeSenderEmail}" style="color: #111827;">${safeSenderEmail}</a>.
    </p>
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sent via HRHandle</p>
  </div>
</body>
</html>`,
  })
}
