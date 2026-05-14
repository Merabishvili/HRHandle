'use client'

import { useRef, useState } from 'react'
import { submitPublicApplication } from '@/lib/actions/public-apply'
import type { ParsedCVInput } from '@/lib/validations/candidate-background'
import { Loader2, Upload, X, CheckCircle2, FileText, Briefcase, GraduationCap, AlertCircle } from 'lucide-react'

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx']

type ParseState = 'idle' | 'parsing' | 'done' | 'failed'

export function ApplyForm({ token }: { token: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // CV file + parse state
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [parseState, setParseState] = useState<ParseState>('idle')
  const [parsed, setParsed] = useState<ParsedCVInput | null>(null)

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

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/parse-cv', { method: 'POST', body: fd })
      const json = await res.json()

      if (json.success && json.data) {
        const data: ParsedCVInput = json.data
        setParsed(data)
        setParseState('done')
        if (data.first_name) setFirstName(data.first_name)
        if (data.last_name) setLastName(data.last_name)
        if (data.email) setEmail(data.email)
        if (data.phone) setPhone(data.phone)
        if (data.linkedin_profile_url) setLinkedinUrl(data.linkedin_profile_url)
      } else {
        setParseState('failed')
      }
    } catch {
      setParseState('failed')
    }
  }

  const handleRemoveFile = () => {
    setCvFile(null)
    setParsed(null)
    setParseState('idle')
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

    const result = await submitPublicApplication(fd)

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    setSubmitted(true)
    setIsLoading(false)
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 shadow-sm text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h2 className="mt-4 text-xl font-bold text-gray-900">You&apos;ve Applied!</h2>
        <p className="mt-2 text-sm text-gray-600">
          Thank you for applying. We&apos;ve sent a confirmation to <strong>{email}</strong>.
          We will review your details and be in touch.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="mb-6 text-lg font-bold text-gray-900">Apply for this Position</h2>

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
                  Could not auto-fill — please complete the form manually
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
              First Name <span className="text-red-500">*</span>
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
              Last Name <span className="text-red-500">*</span>
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

        {/* ── Experience preview (read-only, only when parsed) ───────────────── */}
        {parsed && parsed.experience.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Briefcase className="h-4 w-4" />
              Experience
            </div>
            <ul className="space-y-2">
              {parsed.experience.map((exp, i) => (
                <li key={i} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
                  <p className="font-medium text-gray-800">{exp.title ?? '—'}</p>
                  <p className="text-gray-600">{exp.company ?? '—'}</p>
                  {(exp.start_date || exp.end_date || exp.is_current) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {exp.start_date ?? '?'} – {exp.is_current ? 'Present' : (exp.end_date ?? '?')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Education preview (read-only, only when parsed) ───────────────── */}
        {parsed && parsed.education.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <GraduationCap className="h-4 w-4" />
              Education
            </div>
            <ul className="space-y-2">
              {parsed.education.map((edu, i) => (
                <li key={i} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
                  <p className="font-medium text-gray-800">{edu.institution ?? '—'}</p>
                  {(edu.degree || edu.field_of_study) && (
                    <p className="text-gray-600">{[edu.degree, edu.field_of_study].filter(Boolean).join(', ')}</p>
                  )}
                  {(edu.start_year || edu.end_year || edu.is_ongoing) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {edu.start_year ?? '?'} – {edu.is_ongoing ? 'Present' : (edu.end_year ?? '?')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || parseState === 'parsing'}
          className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            'Apply Now'
          )}
        </button>

        <p className="text-center text-xs text-gray-400">
          By submitting, you agree to your information being stored for recruitment purposes.
        </p>
      </form>
    </div>
  )
}
