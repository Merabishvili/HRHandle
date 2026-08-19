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

⚠️ **The confirmation link must stay exactly** `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}`:
- `{{ .ConfirmationURL }}` must **not** be used — it breaks cross-browser confirmation (see CLAUDE.md).
- `&next={{ .RedirectTo }}` must be kept — [`app/auth/confirm/route.ts`](../../app/auth/confirm/route.ts) reads `next` to land the user on their intended `emailRedirectTo` (`/dashboard`); without it everyone falls back to `/pipeline`.

---

## Confirm signup

This is a **localized version of the existing template** — same layout (heading,
welcome line, button, paste-link fallback, expiry + ignore notes), with each
visible string wrapped in a `{{ .Data.locale }}` conditional. The link markup is
unchanged from the current template.

**Subject:**

```
{{ if eq .Data.locale "ka" }}დაადასტურეთ რეგისტრაცია{{ else if eq .Data.locale "ru" }}Подтвердите регистрацию{{ else }}Confirm Your Signup{{ end }}
```

**Message body (HTML):**

```html
<h2>{{ if eq .Data.locale "ka" }}დაადასტურეთ თქვენი ელფოსტის მისამართი{{ else if eq .Data.locale "ru" }}Подтвердите адрес электронной почты{{ else }}Confirm your email address{{ end }}</h2>

<p>{{ if eq .Data.locale "ka" }}მოგესალმებით HR Handle-ში. გთხოვთ, დაადასტუროთ თქვენი ელფოსტის მისამართი ანგარიშის დაყენების დასასრულებლად.{{ else if eq .Data.locale "ru" }}Добро пожаловать в HR Handle. Пожалуйста, подтвердите адрес электронной почты, чтобы завершить настройку вашей учётной записи.{{ else }}Welcome to HR Handle. Please confirm your email address to finish setting up your account.{{ end }}</p>

<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}"
     style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
    {{ if eq .Data.locale "ka" }}ელფოსტის მისამართის დადასტურება{{ else if eq .Data.locale "ru" }}Подтвердить адрес электронной почты{{ else }}Confirm email address{{ end }}
  </a>
</p>

<p>{{ if eq .Data.locale "ka" }}ან ჩასვით ეს ბმული თქვენს ბრაუზერში:{{ else if eq .Data.locale "ru" }}Или вставьте эту ссылку в браузер:{{ else }}Or paste this link into your browser:{{ end }}<br>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next={{ .RedirectTo }}">{{ .SiteURL }}/auth/confirm</a>
</p>

<p>{{ if eq .Data.locale "ka" }}უსაფრთხოებისთვის ეს ბმული მალე ვადაგასული გახდება.{{ else if eq .Data.locale "ru" }}В целях безопасности эта ссылка скоро станет недействительной.{{ else }}This link will expire shortly for your security.{{ end }}</p>

<p>{{ if eq .Data.locale "ka" }}თუ თქვენ არ შეგიქმნიათ ანგარიში, უბრალოდ უგულებელყავით ეს წერილი — ქმედება საჭირო არ არის.{{ else if eq .Data.locale "ru" }}Если вы не создавали учётную запись, просто проигнорируйте это письмо — никаких действий не требуется.{{ else }}If you didn't create an account, you can safely ignore this email — no action is needed.{{ end }}</p>
```

### Notes
- OAuth (Google/Microsoft) sign-ups never trigger this email, so `.Data.locale`
  is absent for them — the `{{ else }}` English branch covers that case.

---

## Reset password

Live template — fired by `resetPasswordForEmail` in
[`lib/actions/auth.ts`](../../lib/actions/auth.ts). Locale comes from
`{{ .Data.locale }}` (the user's signup-time metadata). ⚠️ Keep the link exactly
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`
— required for cross-browser reset (see CLAUDE.md).

> **Locale freshness:** `.Data.locale` is set at signup and kept in sync when a
> user changes their UI language — `updateProfile` in
> [`lib/actions/settings.ts`](../../lib/actions/settings.ts) mirrors the chosen
> language into `user_metadata.locale` via `supabase.auth.updateUser`. Accounts
> created before locale-stamping shipped have no `locale` until their next
> language save → English fallback.

**Subject:**

```
{{ if eq .Data.locale "ka" }}აღადგინეთ თქვენი პაროლი{{ else if eq .Data.locale "ru" }}Сброс пароля{{ else }}Reset Your Password{{ end }}
```

**Message body (HTML):**

```html
<h2>{{ if eq .Data.locale "ka" }}აღადგინეთ თქვენი პაროლი{{ else if eq .Data.locale "ru" }}Сбросьте ваш пароль{{ else }}Reset your password{{ end }}</h2>

<p>{{ if eq .Data.locale "ka" }}მივიღეთ მოთხოვნა თქვენი ანგარიშის პაროლის აღსადგენად.{{ else if eq .Data.locale "ru" }}Мы получили запрос на сброс пароля вашей учётной записи.{{ else }}We received a request to reset your account password.{{ end }}</p>

<p>{{ if eq .Data.locale "ka" }}ახალი პაროლის დასაყენებლად დააჭირეთ ქვემოთ მოცემულ ღილაკს:{{ else if eq .Data.locale "ru" }}Нажмите кнопку ниже, чтобы задать новый пароль:{{ else }}Click the button below to set a new password:{{ end }}</p>

<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password"
     style="display:inline-block;padding:10px 16px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;">
    {{ if eq .Data.locale "ka" }}პაროლის აღდგენა{{ else if eq .Data.locale "ru" }}Сбросить пароль{{ else }}Reset Password{{ end }}
  </a>
</p>

<p>{{ if eq .Data.locale "ka" }}უსაფრთხოების მიზნით ეს ბმული მალე ვადაგასული გახდება.{{ else if eq .Data.locale "ru" }}В целях безопасности эта ссылка скоро станет недействительной.{{ else }}This link will expire shortly for security reasons.{{ end }}</p>

<p>{{ if eq .Data.locale "ka" }}თუ თქვენ არ მოგითხოვიათ პაროლის აღდგენა, შეგიძლიათ უგულებელყოთ ეს წერილი.{{ else if eq .Data.locale "ru" }}Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.{{ else }}If you did not request a password reset, you can safely ignore this email.{{ end }}</p>
```

---

## Templates that are NOT used (leave as-is)

These Supabase templates exist in the dashboard but the app never triggers them —
no need to translate:

- **Invite user** — the app sends its **own** invite email via Resend
  ([`sendTeamInviteEmail`](../../lib/email.ts), `/join?token=` link), not
  Supabase's `inviteUserByEmail`. That real invite email **is localized in code**
  (EN/KA/RU via `buildTeamInviteEmail`, language = the **inviter's org content
  locale**). The Supabase template here stays unused.
- **Confirm Email Change** — there is no in-app email-change feature
  (`updateUser({ email })` is never called).
- **Confirm Reauthentication** — `supabase.auth.reauthenticate()` is never called.
