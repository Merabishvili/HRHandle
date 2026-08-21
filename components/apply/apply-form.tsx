'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { submitPublicApplication } from '@/lib/actions/public-apply'
import type { ParsedCVInput } from '@/lib/validations/candidate-background'
import { AlertCircle, CheckCircle2, ChevronDown, FileText, Info, Loader2, Upload, X } from 'lucide-react'

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx']

type ParseState = 'idle' | 'parsing' | 'done' | 'failed'

export interface ApplyScreeningQuestion {
  id: string
  label: string
  answer_type: 'yes_no' | 'short_text' | 'number' | 'select'
  is_knockout: boolean
  knockout_answer: string | null
  options: string[] | null
}

interface ApplyFormProps {
  token: string
  /** Name of the recruiting organization — the data controller. Threaded into
   * the GDPR Article 13 notice so candidates know who their data goes to. */
  companyName: string
  /** Wave 2.5 Slice 2b — recruiter-defined screening questions for this
   * vacancy. Rendered between personal details and the GDPR notice. The
   * design says **knockout answers flag the application internally**, so
   * the apply UX is identical regardless of answer — no warning, no
   * blocking. */
  screeningQuestions?: ApplyScreeningQuestion[]
  /** When the org uses AI Fit, the transparency notice is folded into the
   * collapsed privacy section instead of a separate prominent card. */
  aiFitEnabled?: boolean
}

export function ApplyForm({ token, companyName, screeningQuestions = [], aiFitEnabled = false }: ApplyFormProps) {
  const t = useTranslations()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  const [submitted, setSubmitted] = useState(false)
  const [statusToken, setStatusToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  // CV file + parse state
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [parseState, setParseState] = useState<ParseState>('idle')
  const [parsed, setParsed] = useState<ParsedCVInput | null>(null)
  const [parseFailureReason, setParseFailureReason] = useState<'network' | 'file' | null>(null)

  // Personal fields (pre-fillable from CV parse)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')

  // Wave 2.5 Slice 2b — screening question answers. Keyed by question id;
  // values are the raw string the candidate selected/typed. yes_no rows
  // store 'yes' or 'no'; the other answer types pass through their text.
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, string>>({})

  // A-9 — Drive the sticky Apply button's disabled state + the "Add
  // your name and email to apply" hint. We only check the three
  // genuinely required base fields; per-screening-question validation
  // still happens server-side at submit time.
  const isMissingBasics =
    firstName.trim().length === 0 ||
    lastName.trim().length === 0 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  // A-9b — On mobile, cap the visible screening questions at 3 with a
  // "Show N more" toggle so the form doesn't feel infinite. Always
  // show every question on sm+. Auto-expand once the user has
  // answered the first three so we don't trap unanswered required
  // questions below the fold.
  const SCREENING_VISIBLE_CAP = 3
  const [screeningExpanded, setScreeningExpanded] = useState(false)
  const firstThreeAnswered =
    screeningQuestions.length > SCREENING_VISIBLE_CAP &&
    screeningQuestions
      .slice(0, SCREENING_VISIBLE_CAP)
      .every((q) => {
        const a = (screeningAnswers[q.id] ?? '').trim()
        return a.length > 0
      })
  const effectivelyExpanded = screeningExpanded || firstThreeAnswered

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (!file) return

    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(t('apply.error.pdfOrWord'))
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('apply.error.fileSize'))
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setError(null)
    setCvFile(file)
    setParsed(null)
    setParseState('parsing')
    setParseFailureReason(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/parse-cv', { method: 'POST', body: fd })
      const json = await res.json()

      if (json.success && json.data) {
        const data: ParsedCVInput = json.data
        setParsed(data)
        setParseState('done')
        if (data.first_name && !firstName) setFirstName(data.first_name)
        if (data.last_name && !lastName) setLastName(data.last_name)
        if (data.email && !email) setEmail(data.email)
        if (data.phone && !phone) setPhone(data.phone)
        if (data.linkedin_profile_url && !linkedinUrl) setLinkedinUrl(data.linkedin_profile_url)
      } else {
        // Server returned a non-success response — most likely the file
        // was malformed / unreadable.
        setParseFailureReason('file')
        setParseState('failed')
      }
    } catch (err) {
      // fetch() itself failed → network/CORS/offline. Distinct from a
      // server-side parse failure on a malformed file.
      console.warn('[apply-form] CV parse network error:', err)
      setParseFailureReason('network')
      setParseState('failed')
    }
  }

  const handleRemoveFile = () => {
    setCvFile(null)
    setParsed(null)
    setParseState('idle')
    setParseFailureReason(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isLoading) return
    setError(null)

    if (!firstName.trim()) { setError(t('apply.error.firstNameRequired')); return }
    if (!lastName.trim()) { setError(t('apply.error.lastNameRequired')); return }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('apply.error.emailRequired'))
      return
    }

    const phoneTrimmed = phone.trim()
    if (phoneTrimmed && (phoneTrimmed.length < 5 || phoneTrimmed.length > 30 || !/^[\d\s\-\+\(\)]+$/.test(phoneTrimmed))) {
      setError(t('apply.error.phoneInvalid'))
      return
    }

    const linkedinTrimmed = linkedinUrl.trim()
    if (linkedinTrimmed && !/^https?:\/\/(www\.)?linkedin\.com\//.test(linkedinTrimmed)) {
      setError(t('apply.error.linkedinInvalid'))
      return
    }

    // Wave 2.5 Slice 2b — every visible screening question must have an
    // answer before submit. Per the design we still let the candidate
    // submit if their answer is a knockout — we just flag internally —
    // but a totally blank answer means the form is incomplete, which is
    // a UX failure rather than a knockout.
    for (const q of screeningQuestions) {
      const answer = (screeningAnswers[q.id] ?? '').trim()
      if (!answer) {
        setError(t('apply.error.answerAll'))
        return
      }
    }

    if (!captchaToken) {
      setError(t('apply.error.captcha'))
      return
    }

    setIsLoading(true)

    const fd = new FormData()
    fd.append('token', token)
    fd.append('first_name', firstName.trim())
    fd.append('last_name', lastName.trim())
    fd.append('email', email.trim().toLowerCase())
    fd.append('phone', phone.trim())
    fd.append('linkedin_profile_url', linkedinUrl.trim())
    if (cvFile) fd.append('cv', cvFile)
    fd.append('website', '') // Honeypot
    fd.append('experience_json', JSON.stringify(parsed?.experience ?? []))
    fd.append('education_json', JSON.stringify(parsed?.education ?? []))
    // Parsed CV profile fields — persisted onto the new candidate so the
    // recruiter sees current role, salary, notice, location, etc. instead of an
    // empty rail (#3/#6). Empty when no CV was uploaded/parsed.
    fd.append(
      'profile_json',
      JSON.stringify({
        current_position: parsed?.current_position ?? null,
        current_company: parsed?.current_company ?? null,
        salary_expectation: parsed?.salary_expectation ?? null,
        notice_period: parsed?.notice_period ?? null,
        location: parsed?.location ?? null,
        timezone: parsed?.timezone ?? null,
        languages: parsed?.languages ?? [],
      }),
    )
    fd.append(
      'screening_answers_json',
      JSON.stringify(
        screeningQuestions.map((q) => ({
          question_id: q.id,
          answer_value: (screeningAnswers[q.id] ?? '').trim(),
        })),
      ),
    )
    fd.append('cf_turnstile_token', captchaToken)

    const result = await submitPublicApplication(fd)

    if (!result.success) {
      setError(result.error)
      turnstileRef.current?.reset()
      setCaptchaToken(null)
      setIsLoading(false)
      return
    }

    setStatusToken(result.statusToken ?? null)
    setSubmitted(true)
    setIsLoading(false)
  }

  if (submitted) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="h-2 bg-primary" aria-hidden />
        <div className="p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="mt-4 text-xl font-bold text-gray-900">{t('apply.successTitle')}</h2>
          <p className="mt-2 text-sm text-gray-600">{t('apply.successBody', { email })}</p>
          {statusToken && (
            <a
              href={`/status/${statusToken}`}
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
            >
              {t('apply.trackApplication')}
              <span aria-hidden>→</span>
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="h-2 bg-primary" aria-hidden />
      <div className="p-8">
      <h2 className="mb-6 text-lg font-bold text-gray-900">{t('apply.applyForPosition')}</h2>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Honeypot */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }}
        />

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── CV Upload (optional, triggers parse) ──────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t('apply.cvLabel')}
            <span className="ml-1.5 text-xs font-normal text-gray-400">{t('apply.cvRecommended')}</span>
          </label>

          {cvFile ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                <span className="flex-1 truncate text-sm text-gray-700">{cvFile.name}</span>
                <span className="text-xs text-gray-400">{(cvFile.size / 1024).toFixed(0)} KB</span>
                {parseState !== 'parsing' && (
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    aria-label={t('apply.removeCvAria')}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              {parseState === 'parsing' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('apply.parsing')}
                </div>
              )}
              {parseState === 'done' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t('apply.parseDone')}
                </div>
              )}
              {parseState === 'failed' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {parseFailureReason === 'network' ? t('apply.parseFailedNetwork') : t('apply.parseFailedFile')}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                // iOS Safari quirk: opening the file picker while a text
                // input is focused can hang the page. Blur first.
                if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur()
                }
                fileInputRef.current?.click()
              }}
              disabled={isLoading}
              // Brand-blue dashed drop zone per Public Pages.dc.html — pale
              // brand-blue tint background, slightly stronger brand-blue
              // dashed border, brand-blue text + icon. Reads as "this is a
              // CV upload" rather than as a generic gray button. Tier 3 of
              // fidelity-audit.md.
              className="flex w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-[oklch(0.8_0.04_250)] bg-[oklch(0.985_0.012_250)] px-4 py-4 text-sm font-medium text-[oklch(0.45_0.16_250)] transition-colors hover:bg-[oklch(0.96_0.025_250)] disabled:opacity-50"
            >
              <Upload className="h-4 w-4" aria-hidden />
              {t('apply.uploadCta')}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleFileChange}
            disabled={isLoading}
          />
        </div>

        {/* ── Personal details (always visible) ─────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('apply.firstName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t('apply.firstNamePlaceholder')}
              maxLength={100}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('apply.lastName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t('apply.lastNamePlaceholder')}
              maxLength={100}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t('apply.email')} <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('apply.emailPlaceholder')}
            maxLength={254}
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('apply.phone')}</label>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('apply.phonePlaceholder')}
              maxLength={30}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('apply.linkedinUrl')}</label>
            <input
              type="url"
              autoComplete="url"
              inputMode="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder={t('apply.linkedinPlaceholder')}
              maxLength={500}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>
        </div>

        {/* ── Screening questions (Wave 2.5 Slice 2b) ───────────────────────── */}
        {screeningQuestions.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-1 text-sm font-bold text-gray-900">{t('apply.screeningTitle')}</h3>
            <p className="mb-4 text-xs text-gray-500">
              {t('apply.screeningSubtitle')}
            </p>
            <div className="space-y-4">
              {screeningQuestions.map((q, idx) => {
                const overCap = idx >= SCREENING_VISIBLE_CAP
                const hidden = overCap && !effectivelyExpanded
                return (
                  <div
                    key={q.id}
                    className={hidden ? 'hidden sm:block' : undefined}
                  >
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {q.label} <span className="text-red-500">*</span>
                  </label>
                  {q.answer_type === 'yes_no' ? (
                    <div className="flex gap-2">
                      {(['yes', 'no'] as const).map((opt) => {
                        const checked = screeningAnswers[q.id] === opt
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setScreeningAnswers((prev) => ({ ...prev, [q.id]: opt }))
                            }
                            aria-pressed={checked}
                            disabled={isLoading}
                            className={
                              checked
                                ? 'flex-1 rounded-lg border-[1.5px] border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors'
                                : 'flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50'
                            }
                          >
                            {opt === 'yes' ? t('apply.yes') : t('apply.no')}
                          </button>
                        )
                      })}
                    </div>
                  ) : q.answer_type === 'number' ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      value={screeningAnswers[q.id] ?? ''}
                      onChange={(e) =>
                        setScreeningAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      disabled={isLoading}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
                    />
                  ) : q.answer_type === 'select' && q.options && q.options.length > 0 ? (
                    <select
                      value={screeningAnswers[q.id] ?? ''}
                      onChange={(e) =>
                        setScreeningAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      disabled={isLoading}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
                    >
                      <option value="" disabled>
                        {t('apply.selectOption')}
                      </option>
                      {q.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={screeningAnswers[q.id] ?? ''}
                      onChange={(e) =>
                        setScreeningAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      maxLength={500}
                      disabled={isLoading}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
                    />
                  )}
                  </div>
                )
              })}
            </div>
            {screeningQuestions.length > SCREENING_VISIBLE_CAP && !effectivelyExpanded && (
              <button
                type="button"
                onClick={() => setScreeningExpanded(true)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[oklch(0.45_0.16_250)] hover:underline sm:hidden"
              >
                {t('apply.showMore', { count: screeningQuestions.length - SCREENING_VISIBLE_CAP })}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        )}

        {/*
          GDPR Article 13 notice — disclosed at the point of collection.
          Identifies the controller (the recruiting org) and HRHandle's role
          as processor, the categories of data collected (including the
          automated CV extraction), the retention rule, and the candidate's
          rights. Routes rights requests to the controller because under our
          processor/controller split (privacy policy §1) HRHandle cannot
          unilaterally fulfil erasure or access for candidate data.
        */}
        {/* GDPR Article 13 notice — collapsed by default on mobile so the
            wall-of-text doesn't bury the Apply button. Tap to expand;
            stays open once expanded for the rest of the session. */}
        <details className="group rounded-lg border border-gray-200 bg-gray-50 text-xs leading-relaxed text-gray-600 [&[open]>summary>svg]:rotate-180">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-gray-700 marker:hidden">
            <Info className="h-3.5 w-3.5 text-gray-500" aria-hidden />
            <span>{t('apply.privacyToggle')}</span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform text-gray-500" aria-hidden />
          </summary>
          <div className="border-t border-gray-200 px-4 pb-4 pt-3">
            <p>{t('apply.privacyIntro', { company: companyName })}</p>
            <p className="mt-2">{t('apply.privacyCollect')}</p>
            {aiFitEnabled && (
              <p className="mt-2">{t('apply.aiReviewBody', { company: companyName })}</p>
            )}
            <p className="mt-2">{t('apply.privacyRetention', { company: companyName })}</p>
            <p className="mt-2">
              {t('apply.privacyRights', { company: companyName })}{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-900"
              >
                {t('apply.privacyPolicyLink')}
              </a>.
            </p>
          </div>
        </details>

        {/* Sticky CTA on mobile so the Apply button stays in thumb-reach.
            Renders inline on sm+ (where the form fits in viewport). Safe-
            area padding keeps it clear of the iOS home indicator. */}
        <div
          className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 pb-3 pt-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:relative sm:-mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        >
          <button
            type="submit"
            disabled={isLoading || parseState === 'parsing' || !captchaToken || isMissingBasics}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('apply.submitting')}
              </>
            ) : (
              t('apply.submit')
            )}
          </button>
          {!isLoading && isMissingBasics && (
            <p className="mt-1.5 text-center text-[11px] text-gray-500">
              {t('apply.missingBasics')}
            </p>
          )}
        </div>

        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onSuccess={(t) => setCaptchaToken(t)}
          onError={() => setCaptchaToken(null)}
          onExpire={() => setCaptchaToken(null)}
          options={{ size: 'invisible' }}
        />
      </form>
      </div>
    </div>
  )
}
