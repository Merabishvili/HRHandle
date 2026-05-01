# Supabase Configuration Reference

Both projects must always be kept in sync unless stated otherwise.

## Projects
- **Staging**: `hrhandle-staging` — project ID `quotchdymcnjlnwtjmgu`
- **Production**: `hrhandle-production` — project ID `fnpyfwhvgzoxgyjafbsg`

---

## Email Templates

### Confirm signup
```html
<h2>Confirm your email address</h2>
<p>Welcome! Please confirm your email address to complete your registration.</p>
<p>This step helps us secure your account and activate your access.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup"
     style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
    Confirm Email
  </a>
</p>
<p>If you did not create an account, you can safely ignore this email.</p>
```
**Important:** must use `token_hash`, NOT `{{ .ConfirmationURL }}` — token_hash works cross-browser.

### Reset password
```html
<h2>Reset your password</h2>
<p>We received a request to reset your account password.</p>
<p>Click the button below to set a new password:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password"
     style="display:inline-block;padding:10px 16px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;">
    Reset Password
  </a>
</p>
<p>This link will expire shortly for security reasons.</p>
<p>If you did not request a password reset, you can safely ignore this email.</p>
```
**Important:** must use `token_hash` — works cross-browser. The forgot-password page must use `flowType: 'implicit'` (already implemented).

### Member invitation
```html
<h2>You're invited to join {{ .SiteURL }}</h2>
<p>You have been invited to create an account and join our platform.</p>
<p>To accept the invitation and set up your account, click the button below:</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:10px 16px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:6px;">
    Accept Invitation
  </a>
</p>
<p>If you were not expecting this invitation, you can ignore this email.</p>
```

### Magic link
```html
<h2>Sign in to your account</h2>
<p>Use the link below to securely sign in to your account.</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
    Sign In
  </a>
</p>
<p>This link will expire shortly for your security.</p>
<p>If you did not request this login, you can safely ignore this email.</p>
```

### Change email address
```html
<h2>Confirm your new email address</h2>
<p>We received a request to change your email address.</p>
<p>
  <strong>Current email:</strong> {{ .Email }}<br>
  <strong>New email:</strong> {{ .NewEmail }}
</p>
<p>Please confirm this change by clicking the button below:</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:10px 16px;background:#f59e0b;color:#ffffff;text-decoration:none;border-radius:6px;">
    Confirm Email Change
  </a>
</p>
<p>If you did not request this change, please ignore this email or contact support immediately.</p>
```

### Confirm reauthentication
```html
<h2>Security verification required</h2>
<p>To continue, please confirm your identity using the code below:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">{{ .Token }}</p>
<p>Enter this code in the application to proceed.</p>
<p>This code will expire shortly for your security.</p>
<p>If you did not attempt this action, you can safely ignore this message.</p>
```

---

## URL Configuration (Authentication → URL Configuration)

### Site URL
- Staging: `https://staging.hrhandle.com`
- Production: `https://hrhandle.com`

### Redirect URLs (must include all of these)
- `https://hrhandle.com/**`
- `https://staging.hrhandle.com/**`
- `http://localhost:3000/**`

---

## Auth Providers (Authentication → Providers)

Both projects must have these enabled:
- **Email** — enabled
- **Google** — enabled (Client ID + Secret from Google Cloud Console)
- **Azure (Microsoft)** — enabled (Client ID + Secret from Azure App Registration), scope: `email`

---

## SMTP (Authentication → SMTP Settings)

Provider: **Resend**
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key
- Sender: `HRHandle <noreply@hrhandle.com>`

Domain `hrhandle.com` must have DKIM/SPF/DMARC DNS records verified in Resend.
