import { Resend } from 'resend'

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  return new Resend(key)
}

const FROM = 'HRHandle <noreply@hrhandle.com>'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

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
