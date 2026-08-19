# Supabase Auth Email Templates

_Last updated: 2026-08-19_

Supabase Auth sends account emails (sign-up confirmation, password reset, etc.)
from templates configured in the **Supabase dashboard**, not from the repo. This
file is the source of truth for those templates so both projects stay in sync.

> **Apply to BOTH projects** — staging (`quotchdymcnjlnwtjmgu`) and production
> (`fnpyfwhvgzoxgyjafbsg`). Dashboard → **Authentication → Emails → Templates**.

## Localization

The app passes the visitor's chosen UI locale into sign-up metadata
(`supabase.auth.signUp({ options: { data: { locale } } })`, see
[`components/auth/sign-up-form.tsx`](../../components/auth/sign-up-form.tsx)). It
surfaces in templates as `{{ .Data.locale }}` (`en` | `ka` | `ru`). Templates use
Go-template conditionals to render the matching language, falling back to English.

⚠️ **The confirmation link must stay exactly** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
— using `{{ .ConfirmationURL }}` breaks cross-browser confirmation (see CLAUDE.md).

---

## Confirm signup

**Subject:**

```
{{ if eq .Data.locale "ka" }}დაადასტურეთ თქვენი HRHandle ანგარიში{{ else if eq .Data.locale "ru" }}Подтвердите вашу учётную запись HRHandle{{ else }}Confirm your HRHandle account{{ end }}
```

**Message body (HTML):**

```html
<table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; color: #111827; max-width: 480px; margin: 0 auto;">
  <tr><td style="padding: 24px 0;">
    <h2 style="margin: 0 0 16px; font-size: 20px;">
      {{ if eq .Data.locale "ka" }}მოგესალმებით HRHandle-ში!{{ else if eq .Data.locale "ru" }}Добро пожаловать в HRHandle!{{ else }}Welcome to HRHandle!{{ end }}
    </h2>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5;">
      {{ if eq .Data.locale "ka" }}გთხოვთ, დაადასტუროთ თქვენი ელფოსტის მისამართი ანგარიშის გასააქტიურებლად.{{ else if eq .Data.locale "ru" }}Пожалуйста, подтвердите адрес электронной почты, чтобы активировать вашу учётную запись.{{ else }}Please confirm your email address to activate your account.{{ end }}
    </p>
    <p style="margin: 0 0 24px;">
      <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup"
         style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px;">
        {{ if eq .Data.locale "ka" }}ელფოსტის დადასტურება{{ else if eq .Data.locale "ru" }}Подтвердить email{{ else }}Confirm email{{ end }}
      </a>
    </p>
    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
      {{ if eq .Data.locale "ka" }}თუ თქვენ არ შეგიქმნიათ ანგარიში, უგულებელყავით ეს წერილი.{{ else if eq .Data.locale "ru" }}Если вы не создавали учётную запись, просто проигнорируйте это письмо.{{ else }}If you didn't create an account, you can safely ignore this email.{{ end }}
    </p>
  </td></tr>
</table>
```

### Notes
- OAuth (Google/Microsoft) sign-ups never trigger this email, so `.Data.locale`
  is absent for them — the `{{ else }}` English branch covers that case.
- Password-reset and other auth emails are **not yet localized** — the app does
  not currently pass a locale through `resetPasswordForEmail`. Tracked as a
  follow-up (see `docs/testing/manual-qa-2026-08-19.md`).
