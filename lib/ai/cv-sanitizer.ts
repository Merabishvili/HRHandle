/**
 * CV sanitizer for AI Fit Analysis (EU AI Act / anti-bias guardrail).
 *
 * Enforces "protected fields never reach the model" **by construction**: the
 * sanitized payload is built from an allowlist of job-relevant structured
 * fields only (experience, education, languages, years, screening answers), so
 * identity fields (name, photo, age/DOB, gender, nationality, ethnicity,
 * marital status, home address, health, religion) can't even be represented in
 * the output type. Any free text that IS included (experience descriptions, an
 * optional CV excerpt) is run through a redaction pass that removes the
 * candidate's own name plus emails / phone numbers / URLs.
 *
 * Pure + framework-free so it's unit-testable and identical on every call path.
 * This is the technical control behind the compliance claim — do NOT bypass it
 * by sending raw candidate data to the model.
 */

export const PROTECTED_CATEGORIES = [
  'name',
  'contact_details',
] as const
export type ProtectedCategory = (typeof PROTECTED_CATEGORIES)[number]

export interface FitExperience {
  company: string | null
  title: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
}

export interface FitEducation {
  institution: string | null
  degree: string | null
  field_of_study: string | null
  start_year: number | null
  end_year: number | null
}

export interface FitScreeningAnswer {
  label: string
  answer: string
}

/** Raw, pre-sanitization input assembled by the server action. `firstName` /
 * `lastName` are supplied ONLY so we can redact the candidate's own name out of
 * free text — they are never copied into the sanitized output. */
export interface RawFitInput {
  firstName?: string | null
  lastName?: string | null
  yearsOfExperience?: number | null
  languages?: string[] | null
  experience?: FitExperience[] | null
  education?: FitEducation[] | null
  screeningAnswers?: FitScreeningAnswer[] | null
  cvText?: string | null
}

export interface SanitizedFitInput {
  yearsOfExperience: number | null
  languages: string[]
  experience: FitExperience[] // descriptions redacted
  education: FitEducation[]
  screeningAnswers: FitScreeningAnswer[] // answers redacted
  cvExcerpt: string | null // redacted
  /** Categories that were present and stripped — surfaced in the UI banner +
   * audit log for transparency ("Name, contact details were removed"). */
  redactedCategories: ProtectedCategory[]
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|io|net|org|co)\/\S+/gi

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Redact the candidate's own name and any contact details from a free-text
 * string. Uses non-stateful `.replace()` (never `.test()` on the global regexes,
 * which is lastIndex-stateful) and reports which protected categories it hit.
 */
export function redactFreeText(
  text: string,
  firstName?: string | null,
  lastName?: string | null,
): { text: string; found: ProtectedCategory[] } {
  const found = new Set<ProtectedCategory>()
  let out = text

  // Contact details FIRST — an email/URL may itself contain the name
  // (jane@x.com), so redact whole contact tokens before per-name redaction
  // partially eats them.
  for (const [re, placeholder] of [
    [EMAIL_RE, '[email]'],
    [URL_RE, '[link]'],
    [PHONE_RE, '[phone]'],
  ] as const) {
    const replaced = out.replace(re, placeholder)
    if (replaced !== out) {
      found.add('contact_details')
      out = replaced
    }
  }

  // Then the candidate's own name (word-boundary, case-insensitive). Skip
  // 1-char tokens to avoid nuking single letters.
  for (const part of [firstName, lastName]) {
    const p = part?.trim()
    if (!p || p.length < 2) continue
    const re = new RegExp(`\\b${escapeRe(p)}\\b`, 'gi')
    const replaced = out.replace(re, '[name]')
    if (replaced !== out) {
      found.add('name')
      out = replaced
    }
  }

  return { text: out, found: [...found] }
}

/**
 * Build the sanitized, model-safe payload from raw candidate data. Identity
 * fields are dropped by construction; free text is redacted.
 */
export function sanitizeForFitAnalysis(input: RawFitInput): SanitizedFitInput {
  const redacted = new Set<ProtectedCategory>()
  // Identity is excluded by construction. If a name was supplied at all, note
  // it in the transparency list even if it never appeared in free text.
  if (input.firstName?.trim() || input.lastName?.trim()) redacted.add('name')

  const scrub = (t: string | null | undefined): string | null => {
    if (!t) return null
    const r = redactFreeText(t, input.firstName, input.lastName)
    r.found.forEach((c) => redacted.add(c))
    return r.text
  }

  const experience = (input.experience ?? []).map((e) => ({
    company: e.company,
    title: e.title,
    start_date: e.start_date,
    end_date: e.end_date,
    is_current: e.is_current,
    description: scrub(e.description),
  }))

  const education = (input.education ?? []).map((e) => ({
    institution: e.institution,
    degree: e.degree,
    field_of_study: e.field_of_study,
    start_year: e.start_year,
    end_year: e.end_year,
  }))

  const screeningAnswers = (input.screeningAnswers ?? []).map((a) => ({
    label: a.label,
    answer: scrub(a.answer) ?? '',
  }))

  return {
    yearsOfExperience: input.yearsOfExperience ?? null,
    languages: input.languages ?? [],
    experience,
    education,
    screeningAnswers,
    cvExcerpt: scrub(input.cvText),
    redactedCategories: [...redacted].sort(),
  }
}
