'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Turnstile } from '@marsidev/react-turnstile'
import { Loader2, Paperclip, CheckCircle2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { submitSupportTicket } from '@/lib/actions/support'
import { SUBJECT_MAX, MESSAGE_MAX, MAX_ATTACHMENTS, type SupportError } from '@/lib/support/validation'

const ERR_KEY: Record<SupportError, string> = {
  subject_required: 'support.err.subjectRequired',
  subject_too_long: 'support.err.subjectTooLong',
  message_required: 'support.err.messageRequired',
  message_too_long: 'support.err.messageTooLong',
  email_required: 'support.err.emailRequired',
  email_invalid: 'support.err.emailInvalid',
  file_type: 'support.err.fileType',
  file_size: 'support.err.fileSize',
  too_many_files: 'support.err.tooManyFiles',
  rate_limited: 'support.err.rateLimited',
  captcha_failed: 'support.err.captcha',
  upload_failed: 'support.err.uploadFailed',
  save_failed: 'support.err.saveFailed',
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.doc,.docx'

/**
 * Support ticket form, shared by the in-app (Settings → Support) and public
 * (/support) surfaces. `isPublic` adds an email field + Turnstile (the latter
 * only when a site key is configured); logged-in submissions derive email + org
 * from the session server-side.
 */
export function SupportForm({ isPublic = false }: { isPublic?: boolean }) {
  const t = useTranslations()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const captchaEnabled = isPublic && !!siteKey

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (captchaEnabled && !captchaToken) {
      setError(t('support.err.captcha'))
      return
    }
    // Build the payload from the text fields, then attach the state-managed
    // files (the native input's FileList may not match after individual removals).
    const fd = new FormData(formRef.current!)
    fd.delete('file')
    files.forEach((f) => fd.append('file', f))
    if (captchaEnabled && captchaToken) fd.append('cf_turnstile_token', captchaToken)
    startTransition(async () => {
      const res = await submitSupportTicket(fd)
      if (res.success) {
        setDone(true)
        formRef.current?.reset()
        setFiles([])
      } else {
        setError(t(ERR_KEY[res.error as SupportError] ?? 'support.err.saveFailed'))
      }
    })
  }

  if (done) {
    return (
      <div className="rounded-xl border border-[oklch(0.9_0.06_150)] bg-[oklch(0.985_0.02_150)] p-6 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[oklch(0.55_0.14_150)]" aria-hidden />
        <h3 className="text-[15px] font-bold text-foreground">{t('support.successTitle')}</h3>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{t('support.successBody')}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setDone(false)}>
          {t('support.sendAnother')}
        </Button>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isPublic && (
        <div className="space-y-1.5">
          <Label htmlFor="support-email">{t('support.emailLabel')}</Label>
          <Input id="support-email" name="email" type="email" required placeholder={t('support.emailPlaceholder')} maxLength={254} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="support-subject">{t('support.subjectLabel')}</Label>
        <Input id="support-subject" name="subject" required placeholder={t('support.subjectPlaceholder')} maxLength={SUBJECT_MAX} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="support-message">{t('support.messageLabel')}</Label>
        <Textarea id="support-message" name="message" required rows={6} placeholder={t('support.messagePlaceholder')} maxLength={MESSAGE_MAX} />
      </div>

      <div className="space-y-1.5">
        <Label>{t('support.attachmentLabel')}</Label>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? [])
            setFiles((prev) => [...prev, ...picked].slice(0, MAX_ATTACHMENTS))
            if (fileRef.current) fileRef.current.value = '' // allow re-picking the same file
          }}
        />
        {files.length > 0 && (
          <ul className="space-y-1.5">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px]">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-foreground">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t('support.removeFile')}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {files.length < MAX_ATTACHMENTS && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            {t('support.attachButton')}
          </Button>
        )}
        <p className="text-[11.5px] text-muted-foreground">{t('support.attachmentHint')}</p>
      </div>

      {captchaEnabled && (
        <Turnstile siteKey={siteKey!} onSuccess={(tok) => setCaptchaToken(tok)} options={{ size: 'flexible' }} />
      )}

      {error && <p className="text-[13px] text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending || (captchaEnabled && !captchaToken)} className="gap-1.5">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {t('support.submit')}
        </Button>
      </div>
    </form>
  )
}
