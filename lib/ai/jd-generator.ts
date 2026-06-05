import { GoogleGenerativeAI } from '@google/generative-ai'

// Mirrors candidate-summary.ts on purpose. Same Gemini API, same fallback,
// same fail-soft return type. Per-feature file rather than a shared helper
// because each prompt is the feature's actual product surface — keeping them
// next to their feature makes review and prompt-update PRs cleaner.
//
// G-001 still applies: while the Gemini API key is on the unpaid tier,
// Google's terms permit them to use submitted content for product
// improvement. Vacancy text isn't personal data, so the privacy risk for
// JD generation is lower than for candidate summary or CV parsing — but
// the policy gap is the same and the resolution is the same (enable
// billing).

const JD_TIMEOUT_MS = 20_000
const RETRY_DELAY_MS = 1_500
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const

export type JdSection = 'description' | 'responsibilities' | 'requirements'

export interface JdGeneratorInput {
  title: string
  department: string | null
  location: string | null
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null
  sector_name: string | null
  /** Free-text recruiter hint, e.g. "senior backend, must know Kubernetes". */
  additional_context: string | null
}

export type JdGeneratorResult =
  | { ok: true; section: JdSection; text: string }
  | { ok: false; reason: 'too_thin' | 'timeout' | 'failed' | 'no_key' }

const SHARED_RULES = `Rules for every output:
- Tone is neutral, professional, and direct. No superlatives ("world-class", "best-in-breed", "rockstar").
- Avoid age-, gender-, or culture-coded language ("rockstar", "ninja", "guru", "young", "aggressive", "energetic").
- Do not invent specific company names, products, technologies, perks, salary, or working hours that were not provided in the input.
- Write in role-neutral third person. Avoid "we" / "our team". Refer to "the role", "the successful candidate", "the team".
- Keep the candidate's language and proper nouns intact. Do not translate.
- Output ONLY the section text — no preamble, no headings, no JSON, no markdown fence.
- If the input is too thin to write the section (e.g. only a single-word title), output exactly: TOO_THIN`

const SECTION_INSTRUCTIONS: Record<JdSection, string> = {
  description: `Write the "About the job" section: 2-3 short paragraphs introducing the role, what the team does, and what success looks like. Maximum 1500 characters.`,
  responsibilities: `Write the "Responsibilities" section as a bulleted list of 4-6 core responsibilities. Each bullet starts with a verb and is one short sentence. Use "- " as the bullet marker. Maximum 1500 characters.`,
  requirements: `Write the "Requirements" section as a bulleted list of 4-6 must-haves. Each bullet is one short sentence. Use "- " as the bullet marker. Avoid years-of-experience thresholds unless the input includes them. Maximum 1500 characters.`,
}

function buildPrompt(input: JdGeneratorInput, section: JdSection): string {
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
  if (input.additional_context?.trim()) {
    facts.push(`Recruiter notes: ${input.additional_context.trim()}`)
  }

  return [
    'You are a recruiting copilot helping a recruiter draft a job description.',
    '',
    SECTION_INSTRUCTIONS[section],
    '',
    SHARED_RULES,
    '',
    'Role data:',
    facts.join('\n'),
  ].join('\n')
}

/**
 * True if there's almost no signal to write a JD section from. A bare title
 * with no other context can produce a passable description but will hallucinate
 * responsibilities and requirements out of thin air. Be strict — better to ask
 * the recruiter for more input than to fabricate.
 */
function isTooThin(input: JdGeneratorInput, section: JdSection): boolean {
  const title = input.title.trim()
  if (title.length < 2) return true

  const hasAuxContext =
    !!(input.department?.trim()) ||
    !!(input.location?.trim()) ||
    !!(input.employment_type) ||
    !!(input.sector_name?.trim()) ||
    !!(input.additional_context?.trim())

  // Description can be written from just a non-trivial title.
  if (section === 'description') {
    return title.split(/\s+/).length < 2 && !hasAuxContext
  }

  // Responsibilities and requirements need more context — a single-word
  // title is not enough signal to enumerate concrete duties or must-haves.
  return !hasAuxContext && title.split(/\s+/).length < 3
}

async function callGeminiWithTimeout(
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string | { error: 'timeout' | 'failed' }> {
  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({ model: modelName })

  const timeout = new Promise<{ error: 'timeout' }>((resolve) =>
    setTimeout(() => resolve({ error: 'timeout' }), JD_TIMEOUT_MS),
  )

  try {
    const result = await Promise.race([
      model.generateContent(prompt).then((r) => ({ text: r.response.text() })),
      timeout,
    ])
    if ('error' in result) return { error: 'timeout' }
    return result.text
  } catch (err) {
    console.error('[ai/jd-generator] gemini call failed:', err)
    return { error: 'failed' }
  }
}

/**
 * Generate one section of a job description: 'description', 'responsibilities',
 * or 'requirements'. Advisory only — caller chooses what to do with the output.
 * The form is never modified from inside this function.
 */
export async function generateJobDescriptionSection(
  input: JdGeneratorInput,
  section: JdSection,
): Promise<JdGeneratorResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[ai/jd-generator] GOOGLE_GEMINI_API_KEY not configured')
    return { ok: false, reason: 'no_key' }
  }

  if (isTooThin(input, section)) {
    return { ok: false, reason: 'too_thin' }
  }

  const prompt = buildPrompt(input, section)

  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i]
    const result = await callGeminiWithTimeout(apiKey, modelName, prompt)

    if (typeof result === 'string') {
      const trimmed = result.trim()
      if (trimmed === 'TOO_THIN') return { ok: false, reason: 'too_thin' }
      if (trimmed.length > 0) return { ok: true, section, text: trimmed }
    }

    if (i === MODELS.length - 1) {
      const reason = typeof result === 'string' ? 'failed' : result.error
      return { ok: false, reason }
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }

  return { ok: false, reason: 'failed' }
}
