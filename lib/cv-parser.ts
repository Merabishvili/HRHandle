import { GoogleGenerativeAI } from '@google/generative-ai'
import * as Sentry from '@sentry/nextjs'
import { ParsedCVSchema, type ParsedCVInput } from '@/lib/validations/candidate-background'

const PARSE_TIMEOUT_MS = 25_000
const MIN_TEXT_LENGTH = 100
const RETRY_DELAY_MS = 2_000
// gemini-2.0-flash was retired by Google in mid-2026; replaced with
// gemini-2.5-flash-lite (same family, stable, cheaper than 2.5-flash).
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']

const CV_PROMPT = `You are a CV/resume parser. Extract structured information from the CV text below.

Return ONLY a valid JSON object — no markdown, no explanation, no extra text.

Rules:
- If a field cannot be determined with confidence, use null. Do NOT guess or invent data.
- Extract ALL experience and education entries found in the CV, not just the most recent.
- Dates: use "YYYY-MM" format for month+year (e.g. "2021-03"), or "YYYY-01" if only year is given.
- is_current: true only when the person explicitly states they still work there (e.g. "present", "current", "now", "დღემდე").
- is_ongoing: true only when education is explicitly stated as ongoing/current.
- Keep all text in the original language — do not translate.
- current_position and current_company: the candidate's present or most recent job. Take the title and company from the most recent experience entry — the one marked present/current, or (if none) the one with the latest dates, or the one listed first. Only use null when there is no work experience at all.
- location: city and/or country where the candidate is based (e.g. "Tbilisi, Georgia"). Use null if not stated.
- timezone: UTC offset or timezone name if mentioned (e.g. "GMT+4", "UTC+3", "Europe/London"). Use null if not stated.
- languages: array of languages the candidate speaks (e.g. ["English", "Georgian"]). Use [] if none listed.
- salary_expectation: stated salary expectation as written (e.g. "5000 GEL/month"). Use null if not stated.
- notice_period: stated notice period as written (e.g. "2 weeks", "1 month"). Use null if not stated.

JSON structure to fill:
{
  "first_name": null,
  "last_name": null,
  "email": null,
  "phone": null,
  "linkedin_profile_url": null,
  "location": null,
  "timezone": null,
  "languages": [],
  "salary_expectation": null,
  "notice_period": null,
  "current_position": null,
  "current_company": null,
  "experience": [
    {
      "company": null,
      "title": null,
      "start_date": null,
      "end_date": null,
      "is_current": false,
      "description": null
    }
  ],
  "education": [
    {
      "institution": null,
      "degree": null,
      "field_of_study": null,
      "start_year": null,
      "end_year": null,
      "is_ongoing": false
    }
  ]
}

CV text:
`

export type CVParseSuccess = { success: true; data: ParsedCVInput }
export type CVParseFailure = { success: false; reason: 'unreadable' | 'parse_failed' | 'timeout' | 'empty' }
export type CVParseResult = CVParseSuccess | CVParseFailure

type ExperienceEntry = ParsedCVInput['experience'][number]

/**
 * Sortable "recency" key for an experience entry. Parsed dates are zero-padded
 * "YYYY-MM" strings, so a lexical compare orders them correctly. An ongoing role
 * (flagged `is_current`, or with no end date) sorts newest.
 */
function recencyKey(e: ExperienceEntry): string {
  if (e.is_current || !e.end_date) return '9999-99'
  return e.end_date
}

/**
 * Pick the candidate's present/most-recent role from their experience list:
 * an explicitly-current entry wins, else the latest by end date, else — on ties
 * or missing dates — the first listed (CVs lead with the newest role, and
 * `Array.sort` is stable so first-listed wins). Returns null if there's no
 * usable experience. Pure — unit-tested.
 */
export function deriveCurrentRole(
  experience: ExperienceEntry[],
): { title: string | null; company: string | null } | null {
  const usable = experience.filter((e) => e.title || e.company)
  if (usable.length === 0) return null
  const best = [...usable].sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)))[0]!
  return { title: best.title, company: best.company }
}

/**
 * The model frequently leaves `current_position` / `current_company` null even
 * when the experience section clearly names a current job (#3). Backfill each
 * field independently from the derived current role so the wizard/edit form and
 * CV export get it populated. Never overwrites a value the model did extract.
 */
export function backfillCurrentRole(data: ParsedCVInput): ParsedCVInput {
  if (data.current_position && data.current_company) return data
  const cur = deriveCurrentRole(data.experience)
  if (!cur) return data
  return {
    ...data,
    current_position: data.current_position || cur.title,
    current_company: data.current_company || cur.company,
  }
}

export async function extractTextFromFile(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    return extractFromPDF(file)
  }
  if (ext === 'docx' || ext === 'doc') {
    return extractFromDOCX(file)
  }
  return null
}

async function extractFromPDF(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    // `unpdf` is a thin wrapper around pdfjs-dist that handles all the
    // worker / DOMMatrix-polyfill plumbing internally. Using it directly
    // instead of pdfjs-dist avoids the
    //   "Setting up fake worker failed: No workerSrc specified"
    // crash that occurs on Vercel's bundled Node serverless runtime.
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return text || null
  } catch (err) {
    console.error('[cv-parser] extractFromPDF failed:', err)
    return null
  }
}

async function extractFromDOCX(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value || null
  } catch (err) {
    console.error('[cv-parser] extractFromDOCX failed:', err)
    return null
  }
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message
  return msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('overloaded')
}

export async function parseCV(text: string): Promise<CVParseResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    // Validated as optional in lib/env.ts. CV parsing is a non-essential
    // feature; degrade silently in production but warn so the missing key
    // is visible in server logs (audit S-019).
    console.warn('[cv-parser] GOOGLE_GEMINI_API_KEY not set — returning parse_failed')
    return { success: false, reason: 'parse_failed' }
  }

  const genAI = new GoogleGenerativeAI(apiKey)

  for (let modelIdx = 0; modelIdx < MODELS.length; modelIdx++) {
    const model = genAI.getGenerativeModel({ model: MODELS[modelIdx]! })

    if (modelIdx > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }

    try {
      const result = await Promise.race([
        model.generateContent(CV_PROMPT + text),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), PARSE_TIMEOUT_MS)
        ),
      ])

      const raw = (result as Awaited<ReturnType<typeof model.generateContent>>)
        .response.text()
        .trim()
        // Strip markdown code fences if the model adds them despite the prompt
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        console.error('[cv-parser] JSON.parse failed, raw (first 500):', raw.slice(0, 500))
        return { success: false, reason: 'parse_failed' }
      }

      const validated = ParsedCVSchema.safeParse(parsed)
      if (!validated.success) {
        console.error('[cv-parser] Zod validation failed:', JSON.stringify(validated.error.errors))
        return { success: false, reason: 'parse_failed' }
      }

      return { success: true, data: backfillCurrentRole(validated.data) }
    } catch (err) {
      if (err instanceof Error && err.message === 'timeout') {
        if (modelIdx < MODELS.length - 1) continue
        console.error('[cv-parser] Gemini timed out on all models')
        Sentry.captureException(err, { tags: { feature: 'cv_parser', reason: 'timeout' } })
        return { success: false, reason: 'timeout' }
      }
      if (isRetryable(err) && modelIdx < MODELS.length - 1) {
        continue
      }
      console.error('[cv-parser] Gemini call threw:', err)
      Sentry.captureException(err, { tags: { feature: 'cv_parser' } })
      return { success: false, reason: 'parse_failed' }
    }
  }

  return { success: false, reason: 'parse_failed' }
}

export async function parseCVFile(file: File): Promise<CVParseResult> {
  const text = await extractTextFromFile(file)

  if (!text) {
    console.error(`[cv-parser] text extraction returned null for file: ${file.name}`)
    return { success: false, reason: 'unreadable' }
  }
  if (text.trim().length < MIN_TEXT_LENGTH) {
    console.error(`[cv-parser] extracted text too short: ${text.trim().length} chars (min ${MIN_TEXT_LENGTH})`)
    return { success: false, reason: 'unreadable' }
  }

  return parseCV(text)
}
