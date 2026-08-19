import { describe, it, expect } from 'vitest'
import { buildPrompt, type AssessmentSuggesterInput } from '@/lib/ai/assessment-suggester'

const base: AssessmentSuggesterInput = {
  title: 'Business Analyst',
  description: null,
  responsibilities: null,
  requirements: null,
  department: null,
  location: null,
  employment_type: null,
  sector_name: null,
  additional_context: null,
}

describe('buildPrompt — existing-skill exclusion', () => {
  it('asks for exactly 5 skills', () => {
    expect(buildPrompt(base)).toMatch(/exactly 5 SKILL labels/)
  })

  it('adds an exclusion block listing already-added criteria', () => {
    const prompt = buildPrompt({ ...base, existing_skills: ['Requirements gathering', 'SQL'] })
    expect(prompt).toMatch(/do NOT suggest any of these/)
    expect(prompt).toContain('- Requirements gathering')
    expect(prompt).toContain('- SQL')
  })

  it('omits the exclusion block when nothing is on the scorecard', () => {
    expect(buildPrompt(base)).not.toMatch(/Already on the scorecard/)
    expect(buildPrompt({ ...base, existing_skills: [] })).not.toMatch(/Already on the scorecard/)
    expect(buildPrompt({ ...base, existing_skills: ['   '] })).not.toMatch(/Already on the scorecard/)
  })
})
