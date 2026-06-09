import { GoogleGenerativeAI } from '@google/generative-ai'
import * as Sentry from '@sentry/nextjs'

// Third feature in lib/ai/. Same Gemini, same fallback, same fail-soft pattern
// as candidate-summary and jd-generator. The only meaningful difference is the
// JSON response shape — we explicitly ask Gemini for structured output and
// validate it on the way back so the UI doesn't have to.

const IQ_TIMEOUT_MS = 25_000
const RETRY_DELAY_MS = 1_500
// gemini-2.0-flash was retired by Google in mid-2026; replaced with
// gemini-2.5-flash-lite (same family, stable, cheaper than 2.5-flash).
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const

export type InterviewQuestionCategory =
  | 'behavioural'
  | 'technical'
  | 'situational'
  | 'closing'

export const INTERVIEW_QUESTION_CATEGORIES: InterviewQuestionCategory[] = [
  'behavioural',
  'technical',
  'situational',
  'closing',
]

export interface InterviewQuestionsSet {
  behavioural: string[]
  technical: string[]
  situational: string[]
  closing: string[]
}

export interface InterviewQuestionsInput {
  title: string
  description: string | null
  responsibilities: string | null
  requirements: string | null
  department: string | null
  location: string | null
  employment_type:
    | 'full_time'
    | 'part_time'
    | 'contract'
    | 'internship'
    | null
  sector_name: string | null
  additional_context: string | null
}

export type InterviewQuestionsResult =
  | { ok: true; questions: InterviewQuestionsSet }
  | {
      ok: false
      reason: 'too_thin' | 'timeout' | 'failed' | 'no_key' | 'malformed'
    }

const RULES = `Strict rules:
- Generate 4-6 questions per category. Each question is ONE sentence.
- Tone is neutral, respectful, and role-focused.
- NEVER ask about protected characteristics: age, gender, race, ethnicity, religion, national origin, family or marital status, pregnancy, sexual orientation, disability, or political views.
- NEVER ask about salary expectations or current compensation — those belong to the offer/negotiation stage, not the interview.
- NEVER use coded or hype language ("rockstar", "ninja", "guru", "young", "aggressive").
- Behavioural questions look at past behaviour ("Tell me about a time when you ...").
- Technical questions probe role-specific skills, knowledge, and trade-offs. Use the role data to make them specific. If the role data is genuinely too thin, write reasonable generic questions for the title.
- Situational questions are hypothetical scenarios ("How would you handle ..." or "What would you do if ...").
- Closing questions are open-ended prompts for the candidate's questions and motivation. Keep them short.
- Do NOT invent specific company names, products, or technologies that are not in the input.
- If the data is so thin that no useful questions can be generated (e.g. a single-character title and no context), output exactly: TOO_THIN`

const OUTPUT_FORMAT = `Output strictly as JSON with this exact shape — no preamble, no markdown fence, no commentary:

{
  "behavioural":  ["...", "...", "...", "...", "..."],
  "technical":    ["...", "...", "...", "...", "..."],
  "situational":  ["...", "...", "...", "...", "..."],
  "closing":      ["...", "...", "...", "...", "..."]
}`

function buildPrompt(input: InterviewQuestionsInput): string {
  const employmentLabel: Record<string, string> = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract: 'Contract',
    internship: 'Internship',
  }

  const facts: string[] = [`Title: ${input.title.trim()}`]
  if (input.department?.trim()) facts.push(`Department: ${input.department.trim()}`)
  if (input.location?.trim()) facts.push(`Location: ${input.location.trim()}`)
  if (input.employment_type) {
    facts.push(`Employment type: ${employmentLabel[input.employment_type] ?? input.employment_type}`)
  }
  if (input.sector_name?.trim()) facts.push(`Sector: ${input.sector_name.trim()}`)
  if (input.description?.trim()) facts.push(`About the role:\n${input.description.trim()}`)
  if (input.responsibilities?.trim()) facts.push(`Responsibilities:\n${input.responsibilities.trim()}`)
  if (input.requirements?.trim()) facts.push(`Requirements:\n${input.requirements.trim()}`)
  if (input.additional_context?.trim()) {
    facts.push(`Recruiter notes / focus areas:\n${input.additional_context.trim()}`)
  }

  return [
    'You are a recruiting copilot helping a recruiter prepare interview questions for a specific role.',
    'Generate interview questions in four categories: BEHAVIOURAL, TECHNICAL, SITUATIONAL, CLOSING.',
    '',
    RULES,
    '',
    OUTPUT_FORMAT,
    '',
    'Role data:',
    facts.join('\n'),
  ].join('\n')
}

function isTooThin(input: InterviewQuestionsInput): boolean {
  const title = input.title.trim()
  if (title.length < 2) return true
  // If we have at least a title with a word in it, the model can usually
  // produce reasonable generic questions. Don't be too strict here.
  return false
}

function parseQuestions(text: string): InterviewQuestionsSet | null {
  // Strip a potential ```json fence even though we asked the model not to use one.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const obj = parsed as Record<string, unknown>
  const result: InterviewQuestionsSet = {
    behavioural: [],
    technical: [],
    situational: [],
    closing: [],
  }

  let total = 0
  for (const category of INTERVIEW_QUESTION_CATEGORIES) {
    const raw = obj[category]
    if (!Array.isArray(raw)) return null
    const cleaned = raw
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .map((q) => q.trim())
    result[category] = cleaned
    total += cleaned.length
  }

  // If every category came back empty, treat as malformed rather than
  // pretending we got useful output.
  if (total === 0) return null

  return result
}

async function callGeminiWithTimeout(
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string | { error: 'timeout' | 'failed' }> {
  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({ model: modelName })

  const timeout = new Promise<{ error: 'timeout' }>((resolve) =>
    setTimeout(() => resolve({ error: 'timeout' }), IQ_TIMEOUT_MS),
  )

  try {
    const result = await Promise.race([
      model.generateContent(prompt).then((r) => ({ text: r.response.text() })),
      timeout,
    ])
    if ('error' in result) return { error: 'timeout' }
    return result.text
  } catch (err) {
    console.error('[ai/interview-questions] gemini call failed:', err)
    Sentry.captureException(err, {
      tags: { feature: 'interview_questions', model: modelName },
    })
    return { error: 'failed' }
  }
}

/**
 * Generate a categorised set of interview questions for a vacancy. Advisory
 * only — the recruiter reviews every question and decides what to use.
 */
export async function generateInterviewQuestions(
  input: InterviewQuestionsInput,
): Promise<InterviewQuestionsResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[ai/interview-questions] GOOGLE_GEMINI_API_KEY not configured')
    return { ok: false, reason: 'no_key' }
  }

  if (isTooThin(input)) {
    return { ok: false, reason: 'too_thin' }
  }

  const prompt = buildPrompt(input)

  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i]
    const result = await callGeminiWithTimeout(apiKey, modelName, prompt)

    if (typeof result === 'string') {
      const trimmed = result.trim()
      if (trimmed === 'TOO_THIN') return { ok: false, reason: 'too_thin' }
      const parsed = parseQuestions(trimmed)
      if (parsed) return { ok: true, questions: parsed }
      // Fall through: model returned non-empty but unparseable text — try the
      // fallback model. If we're on the last model, return malformed.
      if (i === MODELS.length - 1) {
        return { ok: false, reason: 'malformed' }
      }
    } else if (i === MODELS.length - 1) {
      return { ok: false, reason: result.error }
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }

  return { ok: false, reason: 'failed' }
}
