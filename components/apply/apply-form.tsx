'use client'

import { useRef, useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { submitPublicApplication } from '@/lib/actions/public-apply'
import type { ParsedCVInput } from '@/lib/validations/candidate-background'
import { Loader2, Upload, X, CheckCircle2, FileText, AlertCircle } from 'lucide-react'

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx']

type ParseState = 'idle' | 'parsing' | 'done' | 'failed'

interface ApplyFormProps {
  token: string
  /** Name of the recruiting organization — the data controller. Threaded into
   * the GDPR Article 13 notice so candidates know who their data goes to. */
  companyName: string
}

export function ApplyForm({ token, companyName }: ApplyFormProps) {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (!file) return

    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError('Please upload a PDF or Word document (.pdf, .doc, .docx).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be 10 MB or smaller.')
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

    if (!firstName.trim()) { setError('First name is required.'); return }
    if (!lastName.trim()) { setError('Last name is required.'); return }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('A valid email address is required.')
      return
    }

    const phoneTrimmed = phone.trim()
    if (phoneTrimmed && (phoneTrimmed.length < 5 || phoneTrimmed.length > 30 || !/^[\d\s\-\+\(\)]+$/.test(phoneTrimmed))) {
      setError('Please enter a valid phone number.')
      return
    }

    const linkedinTrimmed = linkedinUrl.trim()
    if (linkedinTrimmed && !/^https?:\/\/(www\.)?linkedin\.com\//.test(linkedinTrimmed)) {
      setError('Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/yourname).')
      return
    }

    if (!captchaToken) {
      setError('Security check not complete. Please wait a moment and try again.')
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
      <div className="rounded-xl border border-gray-200 bg-white p-10 shadow-sm text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="mt-4 text-xl font-bold text-gray-900">Thanks for applying!</h2>
        <p className="mt-2 text-sm text-gray-600">
          We&apos;ve sent a confirmation to <strong>{email}</strong>.
          We will review your details and be in touch.
        </p>
        {statusToken && (
          <a
            href={`/status/${statusToken}`}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            Track your application
            <span aria-hidden>→</span>
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="mb-6 text-lg font-bold text-gray-900">Apply for this position</h2>

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
            CV / Resume
            <span className="ml-1.5 text-xs font-normal text-gray-400">(recommended — auto-fills your details)</span>
          </label>

          {cvFile ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                <span className="flex-1 truncate text-sm text-gray-700">{cvFile.name}</span>
                <span className="text-xs text-gray-400">{(cvFile.size / 1024).toFixed(0)} KB</span>
                {parseState !== 'parsing' && (
                  <button type="button" onClick={handleRemoveFile} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {parseState === 'parsing' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Filling in your details…
                </div>
              )}
              {parseState === 'done' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Details filled in — please review below
                </div>
              )}
              {parseState === 'failed' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {parseFailureReason === 'network'
                    ? 'Could not reach the server — please check your connection and complete the form manually.'
                    : 'Could not read this file — please complete the form manually.'}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Upload PDF or Word document (max 10 MB)
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
              First name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              maxLength={100}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Smith"
              maxLength={100}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            maxLength={254}
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              maxLength={30}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">LinkedIn URL</label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              maxLength={500}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>
        </div>

        {/*
          GDPR Article 13 notice — disclosed at the point of collection.
          Identifies the controller (the recruiting org) and HRHandle's role
          as processor, the categories of data collected (including the
          automated CV extraction), the retention rule, and the candidate's
          rights. Routes rights requests to the controller because under our
          processor/controller split (privacy policy §1) HRHandle cannot
          unilaterally fulfil erasure or access for candidate data.
        */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
          <p className="font-semibold text-gray-700">Before you apply</p>
          <p className="mt-2">
            By submitting this form, you&apos;re sharing your personal data with{' '}
            <strong>{companyName}</strong> — the company recruiting for this position and
            the data controller for your application. HRHandle operates this form on their
            behalf as a data processor.
          </p>
          <p className="mt-2">
            <strong>What we collect.</strong> The contact details and CV you submit. If you
            uploaded a CV, the file is processed through automated extraction to pre-fill
            the form fields; no automated hiring decision is taken. We also record the IP
            address of the submission to prevent abuse.
          </p>
          <p className="mt-2">
            <strong>How long we keep it.</strong> Your application is retained while{' '}
            {companyName} actively considers candidates, and deleted within 30 days of{' '}
            {companyName} closing the role or terminating their HRHandle subscription.
          </p>
          <p className="mt-2">
            <strong>Your rights.</strong> You can ask to access, correct, or delete your
            data, or restrict processing. To exercise these rights for this application,
            contact {companyName} directly. For HRHandle&apos;s role as data processor, see
            our{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-900"
            >
              Privacy Policy
            </a>.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading || parseState === 'parsing' || !captchaToken}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            'Apply now'
          )}
        </button>

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
  )
}
