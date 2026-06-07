import { GoogleGenerativeAI } from '@google/generative-ai'

// Fourth feature in lib/ai/. Same Gemini, same fallback, same fail-soft return
// shape as the others. Like candidate-summary (but unlike jd-generator and
// interview-questions), this feature DOES send candidate-relevant data to
// Google — the recruiter's free-text notes will typically contain candidate
// observations. G-001 still applies (Gemini unpaid tier permits training on
// content); the paid-tier switch is more pressing the more features in this
// lane we ship.

const EXTRACT_TIMEOUT_MS = 25_000
const RETRY_DELAY_MS = 1_500
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const

export const MIN_NOTES_LENGTH = 50
export const MAX_NOTES_LENGTH = 8000

export interface NoteExtractorInput {
  candidate_first_name: string
  candidate_last_name: string
  /** Optional role context — improves the AI's framing without changing safety properties. */
  role_title: string | null
  /** Recruiter's pasted free-text notes from an interview. Validated upstream. */
  raw_notes: string
}

export interface StructuredNotes {
  summary: string
  strengths: string[]
  concerns: string[]
  key_skills_demonstrated: string[]
  follow_ups: string[]
}

export type NoteExtractorResult =
  | { ok: true; structured: StructuredNotes }
  | {
      ok: false
      reason: 'too_thin' | 'timeout' | 'failed' | 'no_key' | 'malformed'
    }

const RULES = `Strict rules:
- Use ONLY information present in the notes. Do not infer, speculate, or add context.
- Be neutral and factual. Do NOT judge, rank, or rate the candidate.
- NEVER infer or include protected characteristics: age, gender, race, ethnicity, religion, national origin, family or marital status, pregnancy, sexual orientation, disability, or political views — even if hints appear in the notes.
- NEVER make a hiring recommendation ("advance", "reject", "hire", "pass"). The recruiter decides.
- NEVER include the candidate's salary expectations in the structured output even if mentioned in the notes — those belong to the offer stage.
- Keep the recruiter's language and proper nouns intact. Do not translate.
- If the notes are too short, too vague, or contain no useful interview content (fewer than ~30 meaningful words), output exactly: TOO_THIN
- Otherwise output the JSON shape exactly as specified below. Any of the array fields may be empty if the notes contain nothing for that category.`

const OUTPUT_FORMAT = `Output strictly as JSON with this exact shape — no preamble, no markdown fence, no commentary:

{
  "summary": "One or two neutral sentences capturing what happened in the interview.",
  "strengths": ["Observed strength with brief evidence from the notes.", "..."],
  "concerns": ["Observed concern or gap, factually phrased.", "..."],
  "key_skills_demonstrated": ["Skill — brief evidence from the notes.", "..."],
  "follow_ups": ["Open question or topic worth probing in a next round.", "..."]
}`

function buildPrompt(input: NoteExtractorInput): string {
  const candidateLabel =
    `${input.candidate_first_name} ${input.candidate_last_name}`.trim() || 'the candidate'

  const lines: string[] = [
    'You are a recruiting copilot helping an interviewer structure their raw notes after an interview.',
    `The candidate is ${candidateLabel}${input.role_title ? `, being considered for the role: ${input.role_title}` : ''}.`,
    '',
    RULES,
    '',
    OUTPUT_FORMAT,
    '',
    'Raw notes:',
    input.raw_notes.trim(),
  ]
  return lines.join('\n')
}

function parseStructure(text: string): StructuredNotes | null {
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
  if (typeof obj.summary !== 'string') return null

  const stringArray = (raw: unknown): string[] | null => {
    if (!Array.isArray(raw)) return null
    return raw
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .map((q) => q.trim())
  }

  const strengths = stringArray(obj.strengths) ?? []
  const concerns = stringArray(obj.concerns) ?? []
  const key_skills_demonstrated = stringArray(obj.key_skills_demonstrated) ?? []
  const follow_ups = stringArray(obj.follow_ups) ?? []

  // Some array fields may be empty, but if the summary is empty and every list
  // is empty too, the model didn't actually extract anything — treat as malformed.
  const summary = obj.summary.trim()
  if (
    summary.length === 0 &&
    strengths.length === 0 &&
    concerns.length === 0 &&
    key_skills_demonstrated.length === 0 &&
    follow_ups.length === 0
  ) {
    return null
  }

  return { summary, strengths, concerns, key_skills_demonstrated, follow_ups }
}

async function callGeminiWithTimeout(
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string | { error: 'timeout' | 'failed' }> {
  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({ model: modelName })

  const timeout = new Promise<{ error: 'timeout' }>((resolve) =>
    setTimeout(() => resolve({ error: 'timeout' }), EXTRACT_TIMEOUT_MS),
  )

  try {
    const result = await Promise.race([
      model.generateContent(prompt).then((r) => ({ text: r.response.text() })),
      timeout,
    ])
    if ('error' in result) return { error: 'timeout' }
    return result.text
  } catch (err) {
    console.error('[ai/note-extractor] gemini call failed:', err)
    return { error: 'failed' }
  }
}

/**
 * Extract structured observations from a recruiter's free-text interview notes.
 * Advisory only — recruiter reviews every line before using.
 */
export async function extractStructuredNotes(
  input: NoteExtractorInput,
): Promise<NoteExtractorResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[ai/note-extractor] GOOGLE_GEMINI_API_KEY not configured')
    return { ok: false, reason: 'no_key' }
  }

  const trimmed = input.raw_notes.trim()
  if (trimmed.length < MIN_NOTES_LENGTH) {
    return { ok: false, reason: 'too_thin' }
  }

  const prompt = buildPrompt({ ...input, raw_notes: trimmed })

  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i]
    const result = await callGeminiWithTimeout(apiKey, modelName, prompt)

    if (typeof result === 'string') {
      const text = result.trim()
      if (text === 'TOO_THIN') return { ok: false, reason: 'too_thin' }
      const parsed = parseStructure(text)
      if (parsed) return { ok: true, structured: parsed }
      if (i === MODELS.length - 1) return { ok: false, reason: 'malformed' }
    } else if (i === MODELS.length - 1) {
      return { ok: false, reason: result.error }
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }

  return { ok: false, reason: 'failed' }
}
