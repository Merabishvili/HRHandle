import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

const { generateContentMock, getGenerativeModelMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn()
  const getGenerativeModelMock = vi.fn(() => ({ generateContent: generateContentMock }))
  return { generateContentMock, getGenerativeModelMock }
})

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function (this: {
    getGenerativeModel: typeof getGenerativeModelMock
  }) {
    this.getGenerativeModel = getGenerativeModelMock
  }),
}))

import {
  suggestAssessmentItems,
  type AssessmentSuggesterInput,
} from '@/lib/ai/assessment-suggester'

const ORIG_KEY = process.env.GOOGLE_GEMINI_API_KEY

function richInput(
  overrides: Partial<AssessmentSuggesterInput> = {},
): AssessmentSuggesterInput {
  return {
    title: 'Senior Backend Engineer',
    description:
      'We are hiring a senior backend engineer to own our payments service end to end.',
    responsibilities:
      'Own the payments service, mentor mid-level engineers, design new APIs, ' +
      'review PRs, participate in on-call rotation.',
    requirements:
      '5+ years backend experience, strong PostgreSQL skills, distributed systems background.',
    department: 'Engineering',
    location: 'Remote (EU)',
    employment_type: 'full_time',
    sector_name: 'FinTech',
    additional_context: null,
    ...overrides,
  }
}

function geminiResponse(text: string) {
  return Promise.resolve({ response: { text: () => text } })
}

function validPayload() {
  return JSON.stringify({
    skills: [
      'PostgreSQL tuning',
      'Distributed-system design',
      'API design',
      'Mentoring engineers',
      'Code review',
    ],
    prompts: [
      'Describe a backend system you owned end-to-end and the trade-offs you made.',
      'Tell us about a time you mentored a more junior engineer through a difficult problem.',
      'How do you approach designing a public-facing API for a payments service?',
    ],
  })
}

describe('suggestAssessmentItems', () => {
  beforeEach(() => {
    generateContentMock.mockReset()
    getGenerativeModelMock.mockClear()
    process.env.GOOGLE_GEMINI_API_KEY = 'test-key'
  })

  afterAll(() => {
    if (ORIG_KEY === undefined) delete process.env.GOOGLE_GEMINI_API_KEY
    else process.env.GOOGLE_GEMINI_API_KEY = ORIG_KEY
  })

  it('returns parsed skills and prompts on a successful Gemini response', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse(validPayload()))
    const result = await suggestAssessmentItems(richInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.suggestions.skills.length).toBe(5)
      expect(result.suggestions.prompts.length).toBe(3)
      expect(result.suggestions.skills).toContain('PostgreSQL tuning')
      expect(result.suggestions.prompts[0]).toMatch(/end-to-end/i)
    }
  })

  it('returns too_thin when the model emits the TOO_THIN sentinel', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse('TOO_THIN'))
    const result = await suggestAssessmentItems(richInput())
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
  })

  it('returns too_thin without calling Gemini when title is a single character', async () => {
    const result = await suggestAssessmentItems(
      richInput({ title: 'x', description: null, responsibilities: null, requirements: null }),
    )
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('falls back to the second model when the first throws', async () => {
    generateContentMock
      .mockImplementationOnce(() => Promise.reject(new Error('model 1 down')))
      .mockReturnValueOnce(geminiResponse(validPayload()))
    const result = await suggestAssessmentItems(richInput())
    expect(result.ok).toBe(true)
    expect(generateContentMock).toHaveBeenCalledTimes(2)
  })

  it('returns malformed when both models return non-JSON', async () => {
    generateContentMock
      .mockReturnValueOnce(geminiResponse('Here is some prose, not JSON.'))
      .mockReturnValueOnce(geminiResponse('Still not JSON.'))
    const result = await suggestAssessmentItems(richInput())
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('strips a ```json code fence before parsing', async () => {
    const fenced = '```json\n' + validPayload() + '\n```'
    generateContentMock.mockReturnValueOnce(geminiResponse(fenced))
    const result = await suggestAssessmentItems(richInput())
    expect(result.ok).toBe(true)
  })

  it('deduplicates suggestions case-insensitively', async () => {
    const payload = JSON.stringify({
      skills: ['PostgreSQL tuning', 'postgresql tuning', 'API design'],
      prompts: [
        'Describe a backend system you owned.',
        'Describe a Backend System you owned.',
      ],
    })
    generateContentMock.mockReturnValueOnce(geminiResponse(payload))
    const result = await suggestAssessmentItems(richInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.suggestions.skills.length).toBe(2)
      expect(result.suggestions.prompts.length).toBe(1)
    }
  })

  it('drops suggestions that are too short or too long', async () => {
    const payload = JSON.stringify({
      skills: [
        'ok',
        'A reasonable label',
        'x'.repeat(250), // over 200 char limit
      ],
      prompts: [
        'hi', // under 4 chars — drop
        'Tell us about a time you led a project.',
      ],
    })
    generateContentMock.mockReturnValueOnce(geminiResponse(payload))
    const result = await suggestAssessmentItems(richInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.suggestions.skills).toEqual(['A reasonable label'])
      expect(result.suggestions.prompts.length).toBe(1)
    }
  })

  it('returns no_key when GOOGLE_GEMINI_API_KEY is unset', async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY
    const result = await suggestAssessmentItems(richInput())
    expect(result).toEqual({ ok: false, reason: 'no_key' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('builds a prompt that includes the strict rules, the TOO_THIN escape, and the role data', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse(validPayload()))
    await suggestAssessmentItems(richInput())
    const prompt = generateContentMock.mock.calls[0]![0] as string

    // Format guidance — skill labels and open-ended prompts
    expect(prompt).toMatch(/SKILL labels/)
    expect(prompt).toMatch(/PROMPT questions/)
    // Protected-class guard
    expect(prompt).toMatch(/protected characteristics/i)
    // Salary guard
    expect(prompt).toMatch(/salary expectations/i)
    // Coded-language guard
    expect(prompt).toMatch(/rockstar/)
    // TOO_THIN escape hatch
    expect(prompt).toMatch(/TOO_THIN/)
    // Verbatim role facts so the model has the literal text
    expect(prompt).toMatch(/Senior Backend Engineer/)
    expect(prompt).toMatch(/FinTech/)
  })

  it('includes recruiter notes in the prompt when additional_context is provided', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse(validPayload()))
    await suggestAssessmentItems(
      richInput({ additional_context: 'Focus on ownership of payments service.' }),
    )
    const prompt = generateContentMock.mock.calls[0]![0] as string
    expect(prompt).toMatch(/Recruiter notes/)
    expect(prompt).toMatch(/ownership of payments service/)
  })
})
