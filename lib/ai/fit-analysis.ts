import { GoogleGenerativeAI } from '@google/generative-ai'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import type { SanitizedFitInput } from './cv-sanitizer'
import type { RenderedFitAnalysis, FitCriterion } from '@/lib/types/ai-fit'

// Mirrors candidate-summary.ts: same Gemini family, two-model fallback,
// timeout budget, fail-soft. The whole point of this feature is the FRAMING
// (fit-against-criteria + evidence + advisory), enforced by the prompt + the
// defensive parser below.

const FIT_TIMEOUT_MS = 25_000
const RETRY_DELAY_MS = 1_500
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const

/** Bump when the prompt changes — stored on every analysis for provenance. */
export const FIT_PROMPT_VERSION = 'fit-analysis-1'
/** A must-have criterion counts as "met" at or above this per-criterion match. */
export const MEETS_THRESHOLD = 60

export interface FitCriterionSpec {
  name: string
  must_have: boolean
}

const FIT_SYSTEM_PROMPT = `You are a recruiting copilot that assesses how well a candidate's application fits a role's REQUIREMENTS. You are advisory only — you never decide, rank, reject, or advance anyone; a human always decides.

You are given a list of the role's CRITERIA and the candidate's job-relevant data (experience, education, languages, screening answers). The candidate's name, photo, age, gender, nationality and other protected attributes have already been removed — never ask for them or infer them.

Assess fit AGAINST EACH provided criterion. Output ONLY a JSON object, no markdown, no preamble, of exactly this shape:
{
  "criteria": [
    { "name": "<must exactly match one of the provided criterion names>", "match_degree": <0-100 integer, evidence-based>, "evidence": "<short quote from the candidate data>", "explanation": "<plain-language, one sentence>" }
  ],
  "strengths": [ { "text": "<factual strength vs a criterion>", "evidence": "<quote>" } ],
  "to_verify": [ { "text": "<a gap to confirm in screening, phrased as 'to verify' not 'weakness'>" } ],
  "suggested_questions": [ "<a screening question that would resolve a gap>" ],
  "confidence": "low" | "medium" | "high"
}

Hard rules:
- Use ONLY the provided data. Do not invent facts, criteria, or evidence.
- Only use criterion names from the provided list. Never add your own criteria.
- match_degree is fit against THAT criterion, justified by evidence — it is NOT a grade of the person. Do NOT output any overall score.
- Never judge the person ("good/bad candidate", "strong hire"). Assess fit vs requirements only.
- Never reference or infer protected characteristics (age, gender, race, nationality, religion, marital status, health, etc.).
- Never compare this candidate to other candidates or use words like "best", "top", "better than".
- If the data is too thin to assess a criterion, give it a low match_degree with evidence "not evidenced" — do not guess.
`

/** Compact, model-friendly rendering of the sanitized candidate data. */
function buildContext(sanitized: SanitizedFitInput, criteria: FitCriterionSpec[]): string {
  const lines: string[] = []
  lines.push('ROLE CRITERIA (assess against each):')
  for (const c of criteria) {
    lines.push(`- ${c.name}${c.must_have ? ' (must-have)' : ' (nice-to-have)'}`)
  }
  lines.push('')
  lines.push('CANDIDATE DATA (sanitized — protected fields removed):')
  if (sanitized.yearsOfExperience != null) lines.push(`Years of experience: ${sanitized.yearsOfExperience}`)
  if (sanitized.languages.length) lines.push(`Languages: ${sanitized.languages.join(', ')}`)
  if (sanitized.experience.length) {
    lines.push('Experience:')
    for (const e of sanitized.experience.slice(0, 10)) {
      const range = [e.start_date, e.is_current ? 'present' : e.end_date].filter(Boolean).join(' – ')
      lines.push(`- ${e.title ?? 'Role'} at ${e.company ?? 'Company'}${range ? ` (${range})` : ''}${e.description ? `: ${e.description}` : ''}`)
    }
  }
  if (sanitized.education.length) {
    lines.push('Education:')
    for (const e of sanitized.education.slice(0, 6)) {
      lines.push(`- ${[e.degree, e.field_of_study, e.institution].filter(Boolean).join(', ')}`)
    }
  }
  if (sanitized.screeningAnswers.length) {
    lines.push('Screening answers:')
    for (const a of sanitized.screeningAnswers.slice(0, 20)) lines.push(`- ${a.label}: ${a.answer}`)
  }
  return lines.join('\n')
}

export function buildFitPrompt(sanitized: SanitizedFitInput, criteria: FitCriterionSpec[]): string {
  return `${FIT_SYSTEM_PROMPT}\n${buildContext(sanitized, criteria)}`
}

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)))

const ResponseSchema = z.object({
  criteria: z
    .array(
      z.object({
        name: z.string(),
        match_degree: z.number(),
        evidence: z.string().optional().default(''),
        explanation: z.string().optional().default(''),
      }),
    )
    .optional()
    .default([]),
  strengths: z
    .array(z.object({ text: z.string(), evidence: z.string().optional().default('') }))
    .optional()
    .default([]),
  to_verify: z.array(z.object({ text: z.string() })).optional().default([]),
  suggested_questions: z.array(z.string()).optional().default([]),
  confidence: z.enum(['low', 'medium', 'high']).optional().default('low'),
})

/** Pull a JSON object out of a model response that may be fenced or padded. */
function extractJson(raw: string): string | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1]! : raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  return candidate.slice(start, end + 1)
}

/**
 * Parse + normalize a model response into a RenderedFitAnalysis. Defensive:
 * returns null on any malformed/missing JSON so the caller can degrade to
 * "score manually". Criteria are filtered to the PROVIDED list (the model can
 * never invent a criterion), match_degree is clamped, and meets_count /
 * must_have_total are computed from the scorecard, not from the model.
 */
export function parseFitResponse(
  raw: string,
  criteria: FitCriterionSpec[],
): RenderedFitAnalysis | null {
  const json = extractJson(raw)
  if (!json) return null
  let obj: unknown
  try {
    obj = JSON.parse(json)
  } catch {
    return null
  }
  const parsed = ResponseSchema.safeParse(obj)
  if (!parsed.success) return null

  const byName = new Map(criteria.map((c) => [c.name.trim().toLowerCase(), c]))
  const seen = new Set<string>()
  const outCriteria: FitCriterion[] = []
  for (const c of parsed.data.criteria) {
    const spec = byName.get(c.name.trim().toLowerCase())
    if (!spec || seen.has(spec.name)) continue // drop invented / duplicate criteria
    seen.add(spec.name)
    outCriteria.push({
      name: spec.name,
      must_have: spec.must_have,
      match_degree: clamp(c.match_degree),
      evidence: c.evidence,
      explanation: c.explanation,
    })
  }

  const mustHaves = criteria.filter((c) => c.must_have)
  const mustHaveMap = new Map(outCriteria.filter((c) => c.must_have).map((c) => [c.name, c.match_degree]))
  const meets_count = mustHaves.filter((c) => (mustHaveMap.get(c.name) ?? 0) >= MEETS_THRESHOLD).length

  return {
    meets_count,
    must_have_total: mustHaves.length,
    confidence: parsed.data.confidence,
    criteria: outCriteria,
    strengths: parsed.data.strengths,
    to_verify: parsed.data.to_verify,
    suggested_questions: parsed.data.suggested_questions,
  }
}

export type FitRunResult =
  | { ok: true; analysis: RenderedFitAnalysis; modelName: string; rawResponse: string }
  | { ok: false; reason: 'no_key' | 'timeout' | 'failed' | 'unparseable' }

async function callGemini(
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string | { error: 'timeout' | 'failed' }> {
  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({ model: modelName })
  const timeout = new Promise<{ error: 'timeout' }>((resolve) =>
    setTimeout(() => resolve({ error: 'timeout' }), FIT_TIMEOUT_MS),
  )
  try {
    const result = await Promise.race([
      model.generateContent(prompt).then((r) => ({ text: r.response.text() })),
      timeout,
    ])
    if ('error' in result) return { error: 'timeout' }
    return result.text
  } catch (err) {
    console.error('[ai/fit-analysis] gemini call failed:', err)
    Sentry.captureException(err, { tags: { feature: 'ai_fit', model: modelName } })
    return { error: 'failed' }
  }
}

/** Run the analysis on already-sanitized input. Fail-soft. */
export async function runFitAnalysis(
  sanitized: SanitizedFitInput,
  criteria: FitCriterionSpec[],
): Promise<FitRunResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) return { ok: false, reason: 'no_key' }

  const prompt = buildFitPrompt(sanitized, criteria)
  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i]!
    const result = await callGemini(apiKey, modelName, prompt)
    if (typeof result === 'string') {
      const analysis = parseFitResponse(result, criteria)
      if (analysis) return { ok: true, analysis, modelName, rawResponse: result }
      if (i === MODELS.length - 1) return { ok: false, reason: 'unparseable' }
    } else if (i === MODELS.length - 1) {
      return { ok: false, reason: result.error }
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
  }
  return { ok: false, reason: 'failed' }
}
