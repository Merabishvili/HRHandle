import { Resend } from 'resend'
import { format } from 'date-fns'
import { applyVariables, DEFAULT_TEMPLATES } from '@/lib/actions/email-templates'

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  return new Resend(key)
}

const FROM = 'HRHandle <noreply@hrhandle.com>'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

function senderFrom(senderName: string) {
  const safe = senderName.replace(/"/g, '')
  return `${safe} via HRHandle <noreply@hrhandle.com>`
}

export async function sendTeamInviteEmail({
  to,
  inviterName,
  organizationName,
  role,
  token,
}: {
  to: string
  inviterName: string
  organizationName: string
  role: string
  token: string
}) {
  const joinUrl = `${BASE_URL}/join?token=${token}`
  const roleLabel = role === 'admin' ? 'Admin' : 'Member'

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `${inviterName} invited you to join ${organizationName} on HRHandle`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 40px;">
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">You've been invited</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      <strong style="color: #111827;">${inviterName}</strong> has invited you to join
      <strong style="color: #111827;">${organizationName}</strong> as a <strong style="color: #111827;">${roleLabel}</strong>.
    </p>
    <a href="${joinUrl}"
       style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none;
              padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
      Accept Invitation
    </a>
    <p style="color: #9ca3af; font-size: 13px; margin: 24px 0 0;">
      This invitation expires in 7 days. If you weren't expecting this, you can ignore it.
    </p>
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      Or copy this link: <span style="color: #6b7280;">${joinUrl}</span>
    </p>
  </div>
</body>
</html>`,
  })
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
}: {
  to: string
  candidateName: string
  senderName: string
  senderEmail: string
  vacancyTitle: string
  organizationName?: string
  scheduledAt: string
  durationMinutes: number
  interviewType: 'video' | 'phone' | 'onsite'
  meetingLink: string | null
  customSubject?: string
  customBody?: string
}) {
  const date = format(new Date(scheduledAt), 'EEEE, MMMM d, yyyy')
  const time = format(new Date(scheduledAt), 'h:mm a')
  const typeLabel = interviewType === 'video' ? 'Video Call' : interviewType === 'phone' ? 'Phone Call' : 'On-site'

  const vars = {
    candidate_name: candidateName,
    role: vacancyTitle,
    company: organizationName ?? senderName,
    interview_date: date,
    interview_time: time,
    meeting_link: meetingLink ?? '',
    interviewer_name: senderName,
  }
  const defaults = DEFAULT_TEMPLATES.interview_invitation
  const subject = applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)

  const meetingRow = meetingLink
    ? `<tr>
        <td style="padding: 6px 0; color: #6b7280; width: 130px;">Meeting link</td>
        <td style="padding: 6px 0;">
          <a href="${meetingLink}" style="color: #111827; font-weight: 600;">${meetingLink}</a>
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
    <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">Interview Invitation</h1>
    <p style="color: #6b7280; margin: 0 0 24px;">
      Dear <strong style="color: #111827;">${candidateName}</strong>,<br><br>
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

    ${meetingLink ? `
    <a href="${meetingLink}"
       style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none;
              padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-bottom: 24px;">
      Join Meeting
    </a>` : ''}

    <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0;">
      If you have any questions, please reply to this email or contact
      <strong style="color: #111827;">${senderName}</strong> at
      <a href="mailto:${senderEmail}" style="color: #111827;">${senderEmail}</a>.
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
}: {
  to: string
  candidateName: string
  vacancyTitle: string
  organizationName: string
  customSubject?: string
  customBody?: string
}) {
  const vars = { candidate_name: candidateName, role: vacancyTitle, company: organizationName }
  const defaults = DEFAULT_TEMPLATES.application_received
  const subject = applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)

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
      Dear <strong style="color: #111827;">${candidateName}</strong>,<br><br>
      ${body}
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
}: {
  to: string
  candidateName: string
  vacancyTitle: string
  organizationName: string
  senderName: string
  senderEmail: string
  customSubject?: string
  customBody?: string
}) {
  const vars = { candidate_name: candidateName, role: vacancyTitle, company: organizationName }
  const defaults = DEFAULT_TEMPLATES.rejection
  const subject = applyVariables(customSubject ?? defaults.subject, vars)
  const body = applyVariables(customBody ?? defaults.body, vars)

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
      Dear <strong style="color: #111827;">${candidateName}</strong>,<br><br>
      ${body}
    </p>
    <p style="color: #6b7280; font-size: 13px; margin: 0;">
      If you have any questions, you are welcome to contact
      <strong style="color: #111827;">${senderName}</strong> at
      <a href="mailto:${senderEmail}" style="color: #111827;">${senderEmail}</a>.
    </p>
    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sent via HRHandle</p>
  </div>
</body>
</html>`,
  })
}
