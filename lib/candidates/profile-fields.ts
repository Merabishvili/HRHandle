import { z } from 'zod'

/** The parsed-CV profile fields the public apply form posts and the recruiter's
 * candidate rail displays: current role, salary, notice, location, etc. */
export interface CandidateProfileFields {
  current_position: string | null
  current_company: string | null
  salary_expectation: string | null
  notice_period: string | null
  location: string | null
  timezone: string | null
  languages: string[]
}

export const EMPTY_PROFILE_FIELDS: CandidateProfileFields = {
  current_position: null,
  current_company: null,
  salary_expectation: null,
  notice_period: null,
  location: null,
  timezone: null,
  languages: [],
}

const ProfileFieldsSchema = z.object({
  current_position: z.string().max(200).nullable().catch(null),
  current_company: z.string().max(200).nullable().catch(null),
  salary_expectation: z.string().max(200).nullable().catch(null),
  notice_period: z.string().max(100).nullable().catch(null),
  location: z.string().max(200).nullable().catch(null),
  timezone: z.string().max(100).nullable().catch(null),
  languages: z.array(z.string().max(100)).catch([]),
})

/**
 * Parse + sanitize the parsed-CV profile blob the apply form posts. Empty
 * strings become null; anything invalid (over-length, wrong type, bad JSON)
 * degrades to the empty defaults — the CV parse is best-effort and must never
 * fail an application.
 */
export function parseProfileFields(json: string): CandidateProfileFields {
  try {
    const parsed = ProfileFieldsSchema.safeParse(JSON.parse(json))
    if (!parsed.success) return EMPTY_PROFILE_FIELDS
    const clean = (v: string | null): string | null => v?.trim() || null
    return {
      current_position: clean(parsed.data.current_position),
      current_company: clean(parsed.data.current_company),
      salary_expectation: clean(parsed.data.salary_expectation),
      notice_period: clean(parsed.data.notice_period),
      location: clean(parsed.data.location),
      timezone: clean(parsed.data.timezone),
      languages: parsed.data.languages.map((l) => l.trim()).filter(Boolean).slice(0, 20),
    }
  } catch {
    return EMPTY_PROFILE_FIELDS
  }
}
