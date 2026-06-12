import { GoogleGenerativeAI } from '@google/generative-ai'
import * as Sentry from '@sentry/nextjs'

// Sixth feature in lib/ai/. Same Gemini API, same fallback, same fail-soft
// return shape as the others. Vacancy text only — no candidate data sent.
// Mirrors jd-generator's risk posture (lowest in the framework).

const ASSESS_TIMEOUT_MS = 25_000
const RETRY_DELAY_MS = 1_500
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const

/** Matches the DB constraint on vacancy_questions.label (200 max in form
 * input, 500 server-side). Keep AI suggestions inside the form limit so the
 * recruiter can edit them before adding. */
const MAX_LABEL_LENGTH = 200
const MIN_LABEL_LENGTH = 4

export interface AssessmentSuggesterInput {
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

export interface AssessmentSuggestions {
  /** 1-10 score criteria. Short, focused skill labels. */
  skills: string[]
  /** Open-ended evaluation prompts. Full questions, one sentence each. */
  prompts: string[]
}

export type AssessmentSuggesterResult =
  | { ok: true; suggestions: AssessmentSuggestions }
  | {
      ok: false
      reason: 'too_thin' | 'timeout' | 'failed' | 'no_key' | 'malformed'
    }

const RULES = `Strict rules:
- Generate 4-6 SKILL labels (score-type evaluation criteria scored 1-10) and 3-5 PROMPT questions (text-type open-ended evaluation prompts).
- SKILL labels are short focused names of a skill, competency, or knowledge area. They should be specific to the role's domain when the description gives enough signal. Examples: "PostgreSQL tuning", "Distributed-system design", "Mentoring engineers", "Customer-conversation skills". Keep each skill label under 60 characters.
- PROMPT questions are open-ended evaluation questions the recruiter asks the candidate to write or talk through. They should probe depth, not surface facts. Examples: "Describe a backend system you owned end-to-end and the trade-offs you made.", "Tell us about a time you had to lead a project through significant scope changes." Keep each prompt under 200 characters.
- Tone is neutral and respectful. NEVER ask about protected characteristics (age, gender, race, ethnicity, religion, national origin, family or marital status, pregnancy, sexual orientation, disability, or political views).
- NEVER include the candidate's salary expectations as an assessment criterion — those belong to the offer stage.
- NEVER use coded language ("rockstar", "ninja", "guru", "aggressive").
- Use the role data to make suggestions specific. If the data is genuinely sparse, use reasonable defaults appropriate to the title.
- Do NOT invent specific company names, products, or proprietary technologies that are not in the input.
- If the data is so sparse that no useful suggestions can be made (e.g. a single-character title and nothing else), output exactly: TOO_THIN`

const OUTPUT_FORMAT = `Output strictly as JSON with this exact shape — no preamble, no markdown fence, no commentary:

{
  "skills":  ["...", "...", "...", "...", "..."],
  "prompts": ["...", "...", "..."]
}`

function buildPrompt(input: AssessmentSuggesterInput): string {
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
  if (input.responsibilities?.trim())
    facts.push(`Responsibilities:\n${input.responsibilities.trim()}`)
  if (input.requirements?.trim()) facts.push(`Requirements:\n${input.requirements.trim()}`)
  if (input.additional_context?.trim()) {
    facts.push(`Recruiter notes / focus areas:\n${input.additional_context.trim()}`)
  }

  return [
    'You are a recruiting copilot helping a recruiter design an assessment for a specific role.',
    'Suggest two kinds of evaluation items: short SKILL labels (scored 1-10 after the interview) and open-ended PROMPT questions (the candidate writes or speaks an answer).',
    '',
    RULES,
    '',
    OUTPUT_FORMAT,
    '',
    'Role data:',
    facts.join('\n'),
  ].join('\n')
}

function isTooThin(input: AssessmentSuggesterInput): boolean {
  // A bare 1-2 character title with no other context can't produce anything
  // useful. Anything beyond that, the model can produce reasonable defaults
  // for a given role family.
  const title = input.title.trim()
  return title.length < 2
}

function parseSuggestions(text: string): AssessmentSuggestions | null {
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
  const rawSkills = obj.skills
  const rawPrompts = obj.prompts
  if (!Array.isArray(rawSkills) || !Array.isArray(rawPrompts)) return null

  const cleanList = (raw: unknown[]): string[] =>
    raw
      .filter((q): q is string => typeof q === 'string')
      .map((q) => q.trim())
      .filter(
        (q) => q.length >= MIN_LABEL_LENGTH && q.length <= MAX_LABEL_LENGTH,
      )
      // Dedupe — case-insensitive — so the suggestion list doesn't repeat itself.
      .filter((q, i, arr) => {
        const lower = q.toLowerCase()
        return arr.findIndex((other) => other.toLowerCase() === lower) === i
      })

  const skills = cleanList(rawSkills)
  const prompts = cleanList(rawPrompts)

  if (skills.length === 0 && prompts.length === 0) return null

  return { skills, prompts }
}

async function callGeminiWithTimeout(
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string | { error: 'timeout' | 'failed' }> {
  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({ model: modelName })

  const timeout = new Promise<{ error: 'timeout' }>((resolve) =>
    setTimeout(() => resolve({ error: 'timeout' }), ASSESS_TIMEOUT_MS),
  )

  try {
    const result = await Promise.race([
      model.generateContent(prompt).then((r) => ({ text: r.response.text() })),
      timeout,
    ])
    if ('error' in result) return { error: 'timeout' }
    return result.text
  } catch (err) {
    console.error('[ai/assessment-suggester] gemini call failed:', err)
    Sentry.captureException(err, {
      tags: { feature: 'assessment_suggester', model: modelName },
    })
    return { error: 'failed' }
  }
}

/**
 * Suggest assessment criteria + open-ended prompts for a vacancy. Advisory
 * only — recruiter reviews each suggestion and adds the ones they want via
 * the existing addVacancyQuestion server action; nothing is auto-saved here.
 */
export async function suggestAssessmentItems(
  input: AssessmentSuggesterInput,
): Promise<AssessmentSuggesterResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[ai/assessment-suggester] GOOGLE_GEMINI_API_KEY not configured')
    return { ok: false, reason: 'no_key' }
  }

  if (isTooThin(input)) {
    return { ok: false, reason: 'too_thin' }
  }

  const prompt = buildPrompt(input)

  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i]!
    const result = await callGeminiWithTimeout(apiKey, modelName, prompt)

    if (typeof result === 'string') {
      const trimmed = result.trim()
      if (trimmed === 'TOO_THIN') return { ok: false, reason: 'too_thin' }
      const parsed = parseSuggestions(trimmed)
      if (parsed) return { ok: true, suggestions: parsed }
      if (i === MODELS.length - 1) return { ok: false, reason: 'malformed' }
    } else if (i === MODELS.length - 1) {
      return { ok: false, reason: result.error }
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }

  return { ok: false, reason: 'failed' }
}
