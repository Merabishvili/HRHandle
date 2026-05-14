import { GoogleGenerativeAI } from '@google/generative-ai'
import { ParsedCVSchema, type ParsedCVInput } from '@/lib/validations/candidate-background'

const PARSE_TIMEOUT_MS = 15_000
const MIN_TEXT_LENGTH = 100

const CV_PROMPT = `You are a CV/resume parser. Extract structured information from the CV text below.

Return ONLY a valid JSON object — no markdown, no explanation, no extra text.

Rules:
- If a field cannot be determined with confidence, use null. Do NOT guess or invent data.
- Extract ALL experience and education entries found in the CV, not just the most recent.
- Dates: use "YYYY-MM" format for month+year (e.g. "2021-03"), or "YYYY-01" if only year is given.
- is_current: true only when the person explicitly states they still work there (e.g. "present", "current", "now", "დღემდე").
- is_ongoing: true only when education is explicitly stated as ongoing/current.
- Keep all text in the original language — do not translate.
- current_position and current_company: the most recent or current role. Use null if not determinable.

JSON structure to fill:
{
  "first_name": null,
  "last_name": null,
  "email": null,
  "phone": null,
  "linkedin_profile_url": null,
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
    const { extractText } = await import('unpdf')
    const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true })
    console.log(`[cv-parser] extractFromPDF: extracted ${text.length} chars`)
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
    const text = result.value || null
    console.log(`[cv-parser] extractFromDOCX: extracted ${text?.length ?? 0} chars`)
    return text
  } catch (err) {
    console.error('[cv-parser] extractFromDOCX failed:', err)
    return null
  }
}

export async function parseCV(text: string): Promise<CVParseResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  console.log('[cv-parser] GEMINI key present:', !!apiKey, '| keys containing GEMINI:', Object.keys(process.env).filter(k => k.includes('GEMINI')))
  if (!apiKey) {
    console.error('[cv-parser] GOOGLE_GEMINI_API_KEY is not set')
    return { success: false, reason: 'parse_failed' }
  }
  console.log(`[cv-parser] calling Gemini, text length: ${text.length}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS)

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await Promise.race([
      model.generateContent(CV_PROMPT + text),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), PARSE_TIMEOUT_MS)
      ),
    ])

    clearTimeout(timer)

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

    return { success: true, data: validated.data }
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.message === 'timeout') {
      console.error('[cv-parser] Gemini call timed out')
      return { success: false, reason: 'timeout' }
    }
    console.error('[cv-parser] Gemini call threw:', err)
    return { success: false, reason: 'parse_failed' }
  }
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
