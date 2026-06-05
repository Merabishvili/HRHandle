import { GoogleGenerativeAI } from '@google/generative-ai'

// Mirrors the cv-parser.ts shape on purpose: same two-model fallback, same
// timeout budget, same "fail soft" return type. When we add the next AI
// feature, look for shared concerns before extracting a helper — premature
// abstraction is worse than two similar files.
//
// Currently the Gemini API key may be on the UNPAID tier (see G-001 in
// docs/issues-found.md). Google's terms permit them to use unpaid-tier
// content to improve their models AND explicitly forbid sending personal
// data to the unpaid services. Every CV / candidate field we send here is
// personal data. The remediation (enable billing on the Gemini account, or
// gate AI features on an env var) MUST be in place before any real EU
// candidate traffic. The privacy policy claim about the paid tier is
// already softened in G-001's tracking entry.

const SUMMARY_TIMEOUT_MS = 20_000
const RETRY_DELAY_MS = 1_500
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const

const SUMMARY_PROMPT = `You are a recruiting copilot helping an HR manager skim a candidate's profile.

Write a NEUTRAL, FACTUAL 2-3 sentence summary of this candidate from the data provided.

Strict rules:
- Use ONLY the data provided. Do not infer, guess, or invent facts.
- Stay neutral. Do NOT judge fit, talent, or strength. Do NOT use superlatives ("excellent", "strong", "ideal").
- Do NOT make hiring recommendations. The recruiter decides.
- Keep candidate language and proper nouns intact. Do not translate.
- Output ONLY the summary text. No preamble, no headings, no JSON, no markdown.
- If the data is too thin (no role, no experience, no education), output exactly:
  TOO_THIN

Candidate data:
`

export interface CandidateSummaryInput {
  first_name: string
  last_name: string
  current_position: string | null
  current_company: string | null
  location: string | null
  years_of_experience: number | null
  languages: string[]
  experience: Array<{
    company: string | null
    title: string | null
    start_date: string | null
    end_date: string | null
    is_current: boolean
  }>
  education: Array<{
    institution: string | null
    degree: string | null
    field_of_study: string | null
  }>
}

export type CandidateSummaryResult =
  | { ok: true; summary: string }
  | { ok: false; reason: 'too_thin' | 'timeout' | 'failed' | 'no_key' }

/**
 * Returns true if the candidate data has so little signal that asking Gemini
 * for a summary would either fail or produce a hallucination. Saves a call.
 */
function isTooThin(input: CandidateSummaryInput): boolean {
  const hasRole = !!(input.current_position?.trim() || input.current_company?.trim())
  const hasExperience = input.experience.some(
    (e) => e.company?.trim() || e.title?.trim(),
  )
  const hasEducation = input.education.some(
    (e) => e.institution?.trim() || e.degree?.trim(),
  )
  return !hasRole && !hasExperience && !hasEducation
}

/**
 * Build a compact, line-based representation of the candidate that's easier
 * for Gemini to consume than nested JSON. PII minimisation: we do NOT include
 * email, phone, LinkedIn URL, date of birth — none of those are needed for a
 * professional summary and excluding them reduces what we send to Google.
 */
function buildCandidateContext(input: CandidateSummaryInput): string {
  const lines: string[] = []
  lines.push(`Name: ${input.first_name} ${input.last_name}`.trim())
  if (input.current_position) lines.push(`Current role: ${input.current_position}`)
  if (input.current_company) lines.push(`Current company: ${input.current_company}`)
  if (input.location) lines.push(`Location: ${input.location}`)
  if (input.years_of_experience != null) {
    lines.push(`Years of experience: ${input.years_of_experience}`)
  }
  if (input.languages.length > 0) {
    lines.push(`Languages: ${input.languages.join(', ')}`)
  }

  if (input.experience.length > 0) {
    lines.push('')
    lines.push('Experience:')
    for (const e of input.experience.slice(0, 8)) {
      const range = [e.start_date, e.is_current ? 'present' : e.end_date]
        .filter(Boolean)
        .join(' – ')
      lines.push(
        `- ${e.title ?? 'Role'} at ${e.company ?? 'Company'}${range ? ` (${range})` : ''}`,
      )
    }
  }

  if (input.education.length > 0) {
    lines.push('')
    lines.push('Education:')
    for (const e of input.education.slice(0, 5)) {
      const parts = [e.degree, e.field_of_study, e.institution].filter(Boolean)
      lines.push(`- ${parts.join(', ')}`)
    }
  }

  return lines.join('\n')
}

async function callGeminiWithTimeout(
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string | { error: 'timeout' | 'failed' }> {
  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({ model: modelName })

  const timeout = new Promise<{ error: 'timeout' }>((resolve) =>
    setTimeout(() => resolve({ error: 'timeout' }), SUMMARY_TIMEOUT_MS),
  )

  try {
    const result = await Promise.race([
      model.generateContent(prompt).then((r) => ({
        text: r.response.text(),
      })),
      timeout,
    ])
    if ('error' in result) return { error: 'timeout' }
    return result.text
  } catch (err) {
    console.error('[ai/candidate-summary] gemini call failed:', err)
    return { error: 'failed' }
  }
}

/**
 * Generate a brief, neutral, factual professional summary for a candidate.
 *
 * Never decides anything — the output is informational only and the recruiter
 * always reviews it. Returns a `too_thin` reason rather than fabricating a
 * summary when the input data is sparse.
 */
export async function summarizeCandidate(
  input: CandidateSummaryInput,
): Promise<CandidateSummaryResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[ai/candidate-summary] GOOGLE_GEMINI_API_KEY not configured')
    return { ok: false, reason: 'no_key' }
  }

  if (isTooThin(input)) {
    return { ok: false, reason: 'too_thin' }
  }

  const prompt = SUMMARY_PROMPT + buildCandidateContext(input)

  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i]
    const result = await callGeminiWithTimeout(apiKey, modelName, prompt)

    if (typeof result === 'string') {
      const trimmed = result.trim()
      if (trimmed === 'TOO_THIN') return { ok: false, reason: 'too_thin' }
      if (trimmed.length > 0) return { ok: true, summary: trimmed }
    }

    // Last model failed too — fall through to the result reason
    if (i === MODELS.length - 1) {
      const reason = typeof result === 'string' ? 'failed' : result.error
      return { ok: false, reason }
    }

    // Brief pause before falling back to the next model
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }

  return { ok: false, reason: 'failed' }
}
