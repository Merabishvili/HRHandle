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

import { checkInclusiveLanguage, type BiasCheckInput } from '@/lib/ai/bias-check'

const ORIG_KEY = process.env.GOOGLE_GEMINI_API_KEY

function richInput(overrides: Partial<BiasCheckInput> = {}): BiasCheckInput {
  return {
    description:
      "We're looking for a rockstar engineer to join our young, energetic team. " +
      'The role involves shipping features and mentoring others.',
    responsibilities:
      'Design and build backend services. Collaborate with product and design. ' +
      'Help maintain a healthy on-call rotation.',
    requirements:
      'Native English speaker. 5+ years of professional experience. ' +
      'Strong communication skills.',
    ...overrides,
  }
}

function geminiResponse(text: string) {
  return Promise.resolve({ response: { text: () => text } })
}

function validFindings() {
  return JSON.stringify({
    findings: [
      {
        field: 'description',
        phrase: 'rockstar engineer',
        category: 'gender_coded',
        reason:
          'Masculine-coded; research shows it reduces female applicant rate.',
        suggestion: 'skilled engineer',
      },
      {
        field: 'description',
        phrase: 'young, energetic team',
        category: 'age_coded',
        reason: 'Excludes older candidates.',
        suggestion: 'collaborative, motivated team',
      },
      {
        field: 'requirements',
        phrase: 'Native English speaker',
        category: 'discriminatory',
        reason: 'Likely problematic under EU equal-treatment law.',
        suggestion: 'Professional fluency in English',
      },
    ],
  })
}

describe('checkInclusiveLanguage', () => {
  beforeEach(() => {
    generateContentMock.mockReset()
    getGenerativeModelMock.mockClear()
    process.env.GOOGLE_GEMINI_API_KEY = 'test-key'
  })

  afterAll(() => {
    if (ORIG_KEY === undefined) delete process.env.GOOGLE_GEMINI_API_KEY
    else process.env.GOOGLE_GEMINI_API_KEY = ORIG_KEY
  })

  it('returns the parsed findings on a successful Gemini response', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse(validFindings()))
    const result = await checkInclusiveLanguage(richInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.findings.length).toBe(3)
      const phrases = result.findings.map((f) => f.phrase)
      expect(phrases).toContain('rockstar engineer')
      expect(phrases).toContain('Native English speaker')
    }
  })

  it('returns an empty findings array when the model says the JD is clean', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse('{"findings": []}'))
    const result = await checkInclusiveLanguage(richInput())
    expect(result).toEqual({ ok: true, findings: [] })
  })

  it('returns too_thin when the model emits the TOO_THIN sentinel', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse('TOO_THIN'))
    const result = await checkInclusiveLanguage(richInput())
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
  })

  it('returns too_thin without calling Gemini when total text is under 50 chars', async () => {
    const result = await checkInclusiveLanguage({
      description: 'too short',
      responsibilities: null,
      requirements: null,
    })
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('falls back to the second model when the first throws', async () => {
    generateContentMock
      .mockImplementationOnce(() => Promise.reject(new Error('model 1 down')))
      .mockReturnValueOnce(geminiResponse(validFindings()))
    const result = await checkInclusiveLanguage(richInput())
    expect(result.ok).toBe(true)
    expect(generateContentMock).toHaveBeenCalledTimes(2)
  })

  it('returns malformed when both models return non-JSON', async () => {
    generateContentMock
      .mockReturnValueOnce(geminiResponse('Here is some prose, not JSON.'))
      .mockReturnValueOnce(geminiResponse('Still not JSON.'))
    const result = await checkInclusiveLanguage(richInput())
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('strips a ```json code fence before parsing', async () => {
    const fenced = '```json\n' + validFindings() + '\n```'
    generateContentMock.mockReturnValueOnce(geminiResponse(fenced))
    const result = await checkInclusiveLanguage(richInput())
    expect(result.ok).toBe(true)
  })

  it('drops findings where the phrase is not actually an exact substring of the field', async () => {
    // Model hallucinates a phrase that does not appear in any of our fields.
    const withHallucination = JSON.stringify({
      findings: [
        {
          field: 'description',
          phrase: 'rockstar engineer', // real
          category: 'gender_coded',
          reason: 'Masculine-coded.',
          suggestion: 'skilled engineer',
        },
        {
          field: 'requirements',
          phrase: 'must be available 24/7', // NOT in our input
          category: 'discriminatory',
          reason: 'Excludes parents.',
          suggestion: 'flexible on-call rotation',
        },
      ],
    })
    generateContentMock.mockReturnValueOnce(geminiResponse(withHallucination))
    const result = await checkInclusiveLanguage(richInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.findings.length).toBe(1)
      expect(result.findings[0]!.phrase).toBe('rockstar engineer')
    }
  })

  it('drops findings with invalid category values', async () => {
    const withBadCategory = JSON.stringify({
      findings: [
        {
          field: 'description',
          phrase: 'rockstar engineer',
          category: 'not_a_real_category', // invalid
          reason: 'Some reason.',
          suggestion: 'skilled engineer',
        },
        {
          field: 'description',
          phrase: 'young, energetic team',
          category: 'age_coded', // valid
          reason: 'Excludes older candidates.',
          suggestion: 'motivated team',
        },
      ],
    })
    generateContentMock.mockReturnValueOnce(geminiResponse(withBadCategory))
    const result = await checkInclusiveLanguage(richInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.findings.length).toBe(1)
      expect(result.findings[0]!.category).toBe('age_coded')
    }
  })

  it('deduplicates identical (field, phrase) pairs the model returns twice', async () => {
    const withDup = JSON.stringify({
      findings: [
        {
          field: 'description',
          phrase: 'rockstar engineer',
          category: 'gender_coded',
          reason: 'A.',
          suggestion: 'skilled engineer',
        },
        {
          field: 'description',
          phrase: 'rockstar engineer',
          category: 'gender_coded',
          reason: 'B.',
          suggestion: 'expert engineer',
        },
      ],
    })
    generateContentMock.mockReturnValueOnce(geminiResponse(withDup))
    const result = await checkInclusiveLanguage(richInput())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.findings.length).toBe(1)
  })

  it('returns no_key when GOOGLE_GEMINI_API_KEY is unset', async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY
    const result = await checkInclusiveLanguage(richInput())
    expect(result).toEqual({ ok: false, reason: 'no_key' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('builds a prompt that lists the categories, the exact-substring rule, the calibration rule, and TOO_THIN', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse('{"findings": []}'))
    await checkInclusiveLanguage(richInput())
    const prompt = generateContentMock.mock.calls[0]![0] as string

    // Category list
    expect(prompt).toMatch(/gender_coded/)
    expect(prompt).toMatch(/age_coded/)
    expect(prompt).toMatch(/discriminatory/)
    // Exact-substring rule
    expect(prompt).toMatch(/exact substring/i)
    expect(prompt).toMatch(/Do not paraphrase/i)
    // Calibration rule
    expect(prompt).toMatch(/Be calibrated, not over-eager/i)
    // TOO_THIN escape hatch
    expect(prompt).toMatch(/TOO_THIN/)
    // Verbatim sample of the description so the model has the literal text
    expect(prompt).toMatch(/rockstar engineer/)
  })
})
