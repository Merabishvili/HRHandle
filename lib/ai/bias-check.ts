import { GoogleGenerativeAI } from '@google/generative-ai'

// Fifth feature in lib/ai/. Same Gemini, same fallback, same fail-soft pattern
// as the others. This one is the lowest-risk-data feature in the framework:
// only vacancy text is sent (no candidate data, no recruiter PII).
//
// G-001 still applies (free-tier Gemini permits training on submitted content)
// but vacancy text isn't personal data so the privacy risk is the lowest of
// the framework — same posture as jd-generator.

const BIAS_TIMEOUT_MS = 20_000
const RETRY_DELAY_MS = 1_500
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const

export type BiasCategory =
  | 'gender_coded'
  | 'age_coded'
  | 'culture_coded'
  | 'pronoun_bias'
  | 'discriminatory'
  | 'cultural_fit_code'
  | 'other'

export type BiasField = 'description' | 'responsibilities' | 'requirements'

export interface BiasFinding {
  field: BiasField
  /** The exact substring from the field's text that triggered the finding. */
  phrase: string
  category: BiasCategory
  /** 1-2 sentence explanation of the specific concern. */
  reason: string
  /** Suggested neutral replacement that preserves meaning. */
  suggestion: string
}

export interface BiasCheckInput {
  description: string | null
  responsibilities: string | null
  requirements: string | null
}

export type BiasCheckResult =
  | { ok: true; findings: BiasFinding[] }
  | {
      ok: false
      reason: 'too_thin' | 'timeout' | 'failed' | 'no_key' | 'malformed'
    }

const VALID_CATEGORIES: ReadonlySet<string> = new Set<BiasCategory>([
  'gender_coded',
  'age_coded',
  'culture_coded',
  'pronoun_bias',
  'discriminatory',
  'cultural_fit_code',
  'other',
])

const VALID_FIELDS: ReadonlySet<string> = new Set<BiasField>([
  'description',
  'responsibilities',
  'requirements',
])

const RULES = `Categories to use:
- gender_coded: words researched to be masculine- or feminine-coded (e.g. rockstar, ninja, guru, aggressive, dominant, nurturing, supportive).
- age_coded: phrases implying age preference (e.g. young, energetic, fresh, recent graduate, mature, seasoned).
- culture_coded: bro-culture or work-hard-play-hard framings; "like family" framings that exclude people with caring responsibilities.
- pronoun_bias: gendered pronouns (he, she, his, her) presuming the candidate's gender. Use "they" or rewrite.
- discriminatory: language that is legally questionable in many jurisdictions (e.g. "native English speaker", "able-bodied", "must lift X kg" without justification, requirements that indirectly exclude protected groups).
- cultural_fit_code: vague "cultural fit", "personality fit", or "culture add" requirements often used to justify discriminatory decisions.
- other: any other inclusion concern not covered above.

Strict rules:
- Only flag specific phrases that ARE in the text. The "phrase" field MUST be an exact substring of the field's text, character-for-character. Do not paraphrase. Do not invent.
- Be calibrated, not over-eager. Do not flag normal recruiter language ("strong communicator", "team player", "self-motivated" are fine). Do not flag a phrase just because it COULD be problematic in some context — only flag if it is actually a concern in this text.
- Each finding has exactly one category. Pick the most specific one.
- The "reason" field is one or two sentences explaining the specific concern (e.g. "Masculine-coded; research shows it reduces female applicant rate.").
- The "suggestion" field is a concrete replacement that preserves the original meaning.
- Do not flag the same phrase twice even if it appears in multiple fields — pick the first.
- If the entire input is too short or empty to review meaningfully (under ~50 characters of meaningful text across all three fields), output exactly: TOO_THIN
- If the text is fine and you find nothing concerning, output {"findings": []}.`

const OUTPUT_FORMAT = `Output strictly as JSON — no preamble, no markdown fence, no commentary:

{
  "findings": [
    {
      "field": "description" | "responsibilities" | "requirements",
      "phrase": "exact substring from the field",
      "category": "one of the categories listed above",
      "reason": "Short explanation of the concern.",
      "suggestion": "Concrete neutral replacement."
    }
  ]
}`

function buildPrompt(input: BiasCheckInput): string {
  const sections: string[] = []
  if (input.description?.trim()) sections.push(`description:\n${input.description.trim()}`)
  if (input.responsibilities?.trim())
    sections.push(`responsibilities:\n${input.responsibilities.trim()}`)
  if (input.requirements?.trim()) sections.push(`requirements:\n${input.requirements.trim()}`)

  return [
    'You are an inclusive-language reviewer for job descriptions.',
    'Read the three fields below and identify specific phrases that may deter underrepresented candidates or signal bias.',
    '',
    RULES,
    '',
    OUTPUT_FORMAT,
    '',
    'Vacancy text:',
    sections.join('\n\n'),
  ].join('\n')
}

function isTooThin(input: BiasCheckInput): boolean {
  const total =
    (input.description?.trim().length ?? 0) +
    (input.responsibilities?.trim().length ?? 0) +
    (input.requirements?.trim().length ?? 0)
  return total < 50
}

function parseFindings(
  text: string,
  input: BiasCheckInput,
): BiasFinding[] | null {
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

  const raw = (parsed as { findings?: unknown }).findings
  if (!Array.isArray(raw)) return null

  const fieldText: Record<BiasField, string> = {
    description: (input.description ?? '').toLowerCase(),
    responsibilities: (input.responsibilities ?? '').toLowerCase(),
    requirements: (input.requirements ?? '').toLowerCase(),
  }

  const seen = new Set<string>()
  const findings: BiasFinding[] = []

  for (const f of raw) {
    if (!f || typeof f !== 'object') continue
    const item = f as Record<string, unknown>
    const field = item.field
    const phrase = item.phrase
    const category = item.category
    const reason = item.reason
    const suggestion = item.suggestion

    if (
      typeof field !== 'string' ||
      !VALID_FIELDS.has(field) ||
      typeof phrase !== 'string' ||
      phrase.trim().length === 0 ||
      typeof category !== 'string' ||
      !VALID_CATEGORIES.has(category) ||
      typeof reason !== 'string' ||
      reason.trim().length === 0 ||
      typeof suggestion !== 'string' ||
      suggestion.trim().length === 0
    ) {
      continue
    }

    // Enforce the "exact substring" rule client-side. Case-insensitive to give
    // the model a little leeway on capitalisation; rejecting outright would
    // create false negatives.
    if (!fieldText[field as BiasField].includes(phrase.trim().toLowerCase())) {
      continue
    }

    // Dedupe identical (field, phrase) pairs.
    const key = `${field}::${phrase.trim().toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)

    findings.push({
      field: field as BiasField,
      phrase: phrase.trim(),
      category: category as BiasCategory,
      reason: reason.trim(),
      suggestion: suggestion.trim(),
    })
  }

  return findings
}

async function callGeminiWithTimeout(
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string | { error: 'timeout' | 'failed' }> {
  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({ model: modelName })

  const timeout = new Promise<{ error: 'timeout' }>((resolve) =>
    setTimeout(() => resolve({ error: 'timeout' }), BIAS_TIMEOUT_MS),
  )

  try {
    const result = await Promise.race([
      model.generateContent(prompt).then((r) => ({ text: r.response.text() })),
      timeout,
    ])
    if ('error' in result) return { error: 'timeout' }
    return result.text
  } catch (err) {
    console.error('[ai/bias-check] gemini call failed:', err)
    return { error: 'failed' }
  }
}

/**
 * Scan a vacancy's text for biased or non-inclusive phrasing. Advisory only —
 * never modifies the input. An empty findings array means "no concerns" (this
 * is a valid happy-path result, not an error).
 */
export async function checkInclusiveLanguage(
  input: BiasCheckInput,
): Promise<BiasCheckResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[ai/bias-check] GOOGLE_GEMINI_API_KEY not configured')
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
      const findings = parseFindings(trimmed, input)
      if (findings !== null) return { ok: true, findings }
      if (i === MODELS.length - 1) return { ok: false, reason: 'malformed' }
    } else if (i === MODELS.length - 1) {
      return { ok: false, reason: result.error }
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }

  return { ok: false, reason: 'failed' }
}
