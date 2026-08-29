import { Resend } from 'resend'
import { applyVariables, escapeHtml, defaultTemplate } from '@/lib/email-template-utils'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'
import { emailChrome } from '@/lib/email-i18n'
import { SUPPORT_EMAIL } from '@/lib/legal/contact'

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  return new Resend(key)
}

const FROM = 'HRHandle <noreply@hrhandle.com>'
const SUPPORT_FROM = `HRHandle Support <${SUPPORT_EMAIL}>`
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
  const locale = contentLocale ?? DEFAULT_LOCALE
  const chrome = emailChrome(locale)
  const tz = timezone || 'UTC'
  const d = new Date(scheduledAt)
  const date = d.toLocaleDateString(chrome.dateTag, { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString(chrome.dateTag, { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })
  const typeLabel = interviewType === 'video' ? chrome.typeVideo : interviewType === 'phone' ? chrome.typePhone : chrome.typeOnsite
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
  const defaults = defaultTemplate('interview_invitation', locale)
  const subject = rescheduled
    ? chrome.interviewRescheduledSubject(vacancyTitle)
    : applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)
  const headingText = rescheduled ? chrome.interviewRescheduled : chrome.interviewInvitation

  const meetingRow = safeMeetingLink
    ? `<tr>
        <td style="padding: 6px 0; color: #6b7280; width: 130px;">${chrome.labelMeetingLink}</td>
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
      ${chrome.dear(`<strong style="color: #111827;">${safeCandidate}</strong>`)}<br><br>
      ${body}
    </p>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 6px 0; color: #6b7280; width: 130px;">${chrome.labelDate}</td>
        <td style="padding: 6px 0; font-weight: 600; color: #111827;">${date}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #6b7280;">${chrome.labelTime}</td>
        <td style="padding: 6px 0; font-weight: 600; color: #111827;">${time}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #6b7280;">${chrome.labelDuration}</td>
        <td style="padding: 6px 0; color: #111827;">${chrome.minutes(durationMinutes)}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #6b7280;">${chrome.labelFormat}</td>
        <td style="padding: 6px 0; color: #111827;">${typeLabel}</td>
      </tr>
      ${meetingRow}
    </table>

    ${safeMeetingLink ? `
    <a href="${safeMeetingLink}"
       style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none;
              padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-bottom: 24px;">
      ${chrome.joinMeeting}
    </a>` : ''}

    <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0;">
      ${chrome.contactReply(
        `<strong style="color: #111827;">${safeSenderName}</strong>`,
        `<a href="mailto:${safeSenderEmail}" style="color: #111827;">${safeSenderEmail}</a>`,
      )}
    </p>
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${chrome.sentVia}</p>
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
  const locale = contentLocale ?? DEFAULT_LOCALE
  const defaults = defaultTemplate('application_received', locale)
  const subject = applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)
  const safeCandidate = escapeHtml(candidateName)
  const safeStatusUrl = statusUrl ? escapeHtml(statusUrl) : null
  const chrome = emailChrome(locale)

  const statusCta = safeStatusUrl
    ? `
    <p style="margin: 0 0 24px;">
      <a href="${safeStatusUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 16px; border-radius: 6px;">${chrome.trackApplication}</a>
    </p>
    <p style="color: #9ca3af; font-size: 12px; margin: 0 0 16px;">
      ${chrome.keepLinkPrivate}
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
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">${chrome.thanksForApplying}</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      ${chrome.dear(`<strong style="color: #111827;">${safeCandidate}</strong>`)}<br><br>
      ${body}
    </p>
    ${statusCta}
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${chrome.sentViaNoReply}</p>
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
  const locale = contentLocale ?? DEFAULT_LOCALE
  const chrome = emailChrome(locale)
  const defaults =
    stage === 'screening'
      ? defaultTemplate('status_change_screening', locale)
      : defaultTemplate('status_change_interview', locale)
  const subject = applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)
  const safeCandidate = escapeHtml(candidateName)
  const safeStatusUrl = statusUrl ? escapeHtml(statusUrl) : null

  const heading = stage === 'screening' ? chrome.underReview : chrome.movingToInterview

  const statusCta = safeStatusUrl
    ? `
    <p style="margin: 0 0 16px;">
      <a href="${safeStatusUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 16px; border-radius: 6px;">${chrome.trackApplication}</a>
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
      ${chrome.dear(`<strong style="color: #111827;">${safeCandidate}</strong>`)}<br><br>
      ${body}
    </p>
    ${statusCta}
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${chrome.sentViaNoReply}</p>
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
  const locale = contentLocale ?? DEFAULT_LOCALE
  const chrome = emailChrome(locale)
  const defaults = defaultTemplate('offer_sent', locale)
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
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">${chrome.youHaveOffer}</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      ${chrome.dear(`<strong style="color: #111827;">${safeCandidate}</strong>`)}<br><br>
      ${body}
    </p>
    <p style="margin: 0 0 16px;">
      <a href="${safeOfferUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 16px; border-radius: 6px;">${chrome.viewOffer}</a>
    </p>
    <p style="color: #9ca3af; font-size: 12px; margin: 0 0 16px;">
      ${chrome.keepLinkPrivateOffer}
    </p>
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${chrome.sentViaNoReply}</p>
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
  const locale = contentLocale ?? DEFAULT_LOCALE
  const chrome = emailChrome(locale)
  const defaults = defaultTemplate('rejection', locale)
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
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">${chrome.hiringUpdate}</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      ${chrome.dear(`<strong style="color: #111827;">${safeCandidate}</strong>`)}<br><br>
      ${body}
    </p>
    <p style="color: #6b7280; font-size: 13px; margin: 0;">
      ${chrome.contactWelcome(
        `<strong style="color: #111827;">${safeSenderName}</strong>`,
        `<a href="mailto:${safeSenderEmail}" style="color: #111827;">${safeSenderEmail}</a>`,
      )}
    </p>
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${chrome.sentVia}</p>
  </div>
</body>
</html>`,
  })
}

// ── Support tickets ────────────────────────────────────────────────────────

/** Short human-friendly reference from the ticket UUID (first block, upper). */
export function ticketRef(ticketId: string): string {
  return ticketId.split('-')[0]?.toUpperCase() ?? ticketId.slice(0, 8).toUpperCase()
}

const SUPPORT_STRINGS: Record<
  Locale,
  { subject: (ref: string) => string; heading: string; intro: string; yourMessage: string; closing: string }
> = {
  en: {
    subject: (ref) => `We received your request (#${ref})`,
    heading: 'Thanks — we got your message',
    intro: "Our team will get back to you at this email address as soon as possible. Here's a copy of what you sent:",
    yourMessage: 'Your message',
    closing: 'You can simply reply to this email to add anything.',
  },
  ka: {
    subject: (ref) => `თქვენი მოთხოვნა მიღებულია (#${ref})`,
    heading: 'მადლობა — თქვენი შეტყობინება მივიღეთ',
    intro: 'ჩვენი გუნდი უმოკლეს ვადაში დაგიკავშირდებათ ამ ელფოსტაზე. ქვემოთ მოცემულია თქვენ მიერ გამოგზავნილის ასლი:',
    yourMessage: 'თქვენი შეტყობინება',
    closing: 'დამატებითი ინფორმაციისთვის უბრალოდ უპასუხეთ ამ წერილს.',
  },
  ru: {
    subject: (ref) => `Мы получили ваш запрос (#${ref})`,
    heading: 'Спасибо — мы получили ваше сообщение',
    intro: 'Наша команда свяжется с вами по этому адресу электронной почты как можно скорее. Ниже — копия отправленного вами:',
    yourMessage: 'Ваше сообщение',
    closing: 'Чтобы что-то добавить, просто ответьте на это письмо.',
  },
}

/** Pure builder for the submitter's confirmation email (subject + HTML). */
export function buildSupportConfirmationEmail({
  ticketId,
  subject,
  message,
  locale,
}: {
  ticketId: string
  subject: string
  message: string
  locale?: Locale | undefined
}): { subject: string; html: string } {
  const s = SUPPORT_STRINGS[locale ?? DEFAULT_LOCALE] ?? SUPPORT_STRINGS[DEFAULT_LOCALE]
  const ref = ticketRef(ticketId)
  return {
    subject: s.subject(ref),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 40px;">
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">${s.heading}</h1>
    <p style="color: #6b7280; margin: 0 0 20px;">${s.intro}</p>
    <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 0 0 20px;">
      <p style="font-size: 12px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">${escapeHtml(s.yourMessage)}</p>
      <p style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 8px;">${escapeHtml(subject)}</p>
      <p style="font-size: 13px; line-height: 1.6; color: #374151; margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
    <p style="color: #9ca3af; font-size: 13px; margin: 0;">${s.closing}</p>
  </div>
</body>
</html>`,
  }
}

/** Pure builder for the internal admin notification (English). */
export function buildSupportNotificationEmail({
  ticketId,
  subject,
  message,
  submitterEmail,
  source,
  organizationId,
  attachments = [],
}: {
  ticketId: string
  subject: string
  message: string
  submitterEmail: string
  source: 'app' | 'public'
  organizationId: string | null
  attachments?: { name: string; url: string }[]
}): { subject: string; html: string } {
  const ref = ticketRef(ticketId)
  const attachmentRow = attachments.length
    ? `<tr><td style="padding: 6px 0; color: #6b7280; width: 110px; vertical-align: top;">${attachments.length > 1 ? 'Attachments' : 'Attachment'}</td><td style="padding: 6px 0;">${attachments
        .map((a) => `<a href="${escapeHtml(a.url)}" style="color: #111827; font-weight: 600; display: block; margin-bottom: 2px;">${escapeHtml(a.name)}</a>`)
        .join('')}</td></tr>`
    : ''
  return {
    subject: `[Support #${ref}] ${subject}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
    <h1 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 4px;">New support ticket #${ref}</h1>
    <p style="color: #9ca3af; font-size: 12px; margin: 0 0 20px;">Reply to this email to respond directly to the sender.</p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr><td style="padding: 6px 0; color: #6b7280; width: 110px;">From</td><td style="padding: 6px 0; font-weight: 600; color: #111827;">${escapeHtml(submitterEmail)}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Source</td><td style="padding: 6px 0; color: #111827;">${source === 'public' ? 'Public form' : 'In-app (logged in)'}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Org</td><td style="padding: 6px 0; color: #111827;">${organizationId ? escapeHtml(organizationId) : '—'}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Subject</td><td style="padding: 6px 0; font-weight: 600; color: #111827;">${escapeHtml(subject)}</td></tr>
      ${attachmentRow}
    </table>
    <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
      <p style="font-size: 13px; line-height: 1.6; color: #374151; margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  </div>
</body>
</html>`,
  }
}

/** Sends both support emails: a localized confirmation to the submitter and an
 * English notification to the support inbox (Reply-To = the submitter, so a
 * plain reply reaches them). Best-effort — the caller catches failures so a
 * mail hiccup never loses the ticket. */
export async function sendSupportTicketEmails({
  ticketId,
  subject,
  message,
  submitterEmail,
  source,
  organizationId,
  attachments = [],
  locale,
}: {
  ticketId: string
  subject: string
  message: string
  submitterEmail: string
  source: 'app' | 'public'
  organizationId: string | null
  attachments?: { name: string; url: string }[]
  locale?: Locale | undefined
}) {
  const resend = getResend()
  const inbox = process.env.SUPPORT_INBOX || SUPPORT_EMAIL

  const confirmation = buildSupportConfirmationEmail({ ticketId, subject, message, locale })
  const notification = buildSupportNotificationEmail({
    ticketId,
    subject,
    message,
    submitterEmail,
    source,
    organizationId,
    attachments,
  })

  await Promise.all([
    resend.emails.send({
      from: SUPPORT_FROM,
      to: submitterEmail,
      replyTo: inbox,
      subject: confirmation.subject,
      html: confirmation.html,
    }),
    resend.emails.send({
      from: FROM,
      to: inbox,
      replyTo: submitterEmail,
      subject: notification.subject,
      html: notification.html,
    }),
  ])
}
