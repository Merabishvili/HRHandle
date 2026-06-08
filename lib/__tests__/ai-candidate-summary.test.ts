import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @google/generative-ai before importing the module under test.
// generateContentMock is the per-test injection point; we re-wire it in
// each test to control responses (resolve, reject, hang).
const { generateContentMock, getGenerativeModelMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn()
  const getGenerativeModelMock = vi.fn(() => ({
    generateContent: generateContentMock,
  }))
  return { generateContentMock, getGenerativeModelMock }
})

vi.mock('@google/generative-ai', () => ({
  // Use a `function` (not arrow) so `new GoogleGenerativeAI(key)` actually
  // works as a constructor. Arrow functions are not constructable.
  GoogleGenerativeAI: function MockGenerativeAI(this: { getGenerativeModel: typeof getGenerativeModelMock }) {
    this.getGenerativeModel = getGenerativeModelMock
  },
}))

import { summarizeCandidate, type CandidateSummaryInput } from '@/lib/ai/candidate-summary'

const ORIGINAL_KEY = process.env.GOOGLE_GEMINI_API_KEY

function richInput(overrides: Partial<CandidateSummaryInput> = {}): CandidateSummaryInput {
  return {
    first_name: 'Alex',
    last_name: 'Doe',
    current_position: 'Senior PM',
    current_company: 'Acme',
    location: 'Tbilisi, Georgia',
    years_of_experience: 8,
    languages: ['English', 'Georgian'],
    experience: [
      {
        company: 'Acme',
        title: 'Senior PM',
        start_date: '2022-01',
        end_date: null,
        is_current: true,
      },
      {
        company: 'Beta Co',
        title: 'PM',
        start_date: '2019-03',
        end_date: '2021-12',
        is_current: false,
      },
    ],
    education: [{ institution: 'TSU', degree: 'BSc', field_of_study: 'CS' }],
    ...overrides,
  }
}

function mockGeminiText(text: string) {
  generateContentMock.mockResolvedValueOnce({
    response: { text: () => text },
  })
}

describe('summarizeCandidate', () => {
  beforeEach(() => {
    generateContentMock.mockReset()
    getGenerativeModelMock.mockClear()
    process.env.GOOGLE_GEMINI_API_KEY = 'test-key'
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.GOOGLE_GEMINI_API_KEY
    else process.env.GOOGLE_GEMINI_API_KEY = ORIGINAL_KEY
    vi.restoreAllMocks()
  })

  it('returns no_key when GOOGLE_GEMINI_API_KEY is unset', async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY
    const result = await summarizeCandidate(richInput())
    expect(result).toEqual({ ok: false, reason: 'no_key' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('returns too_thin without calling Gemini when input has no role, experience or education', async () => {
    const result = await summarizeCandidate(
      richInput({
        current_position: null,
        current_company: null,
        experience: [],
        education: [],
      }),
    )
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('returns the summary on a successful Gemini response', async () => {
    mockGeminiText('Alex is a Senior PM at Acme with 8 years of experience.')
    const result = await summarizeCandidate(richInput())
    expect(result).toEqual({
      ok: true,
      summary: 'Alex is a Senior PM at Acme with 8 years of experience.',
    })
    expect(generateContentMock).toHaveBeenCalledTimes(1)
  })

  it("returns too_thin when the model itself says 'TOO_THIN'", async () => {
    mockGeminiText('TOO_THIN')
    const result = await summarizeCandidate(richInput())
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
  })

  it('falls back to the second model when the first fails', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('first model down'))
    mockGeminiText('A summary from the fallback model.')
    const result = await summarizeCandidate(richInput())
    expect(result).toEqual({
      ok: true,
      summary: 'A summary from the fallback model.',
    })
    expect(generateContentMock).toHaveBeenCalledTimes(2)
    // Confirm both models were tried in order.
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(1, { model: 'gemini-2.5-flash' })
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(2, { model: 'gemini-2.5-flash-lite' })
  })

  it('returns failed when both models throw', async () => {
    generateContentMock.mockRejectedValue(new Error('down'))
    const result = await summarizeCandidate(richInput())
    expect(result).toEqual({ ok: false, reason: 'failed' })
    expect(generateContentMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT include PII like email, phone, linkedin in the prompt', async () => {
    mockGeminiText('A neutral summary.')
    await summarizeCandidate(richInput())
    const sentPrompt = generateContentMock.mock.calls[0][0] as string

    // The input shape doesn't even accept these fields, but defend against
    // future regressions by asserting these substrings never appear.
    expect(sentPrompt).not.toMatch(/email/i)
    expect(sentPrompt).not.toMatch(/phone/i)
    expect(sentPrompt).not.toMatch(/linkedin/i)
    expect(sentPrompt).not.toMatch(/date of birth/i)

    // Sanity-check the prompt DOES contain what we expect.
    expect(sentPrompt).toContain('Alex Doe')
    expect(sentPrompt).toContain('Senior PM')
    expect(sentPrompt).toContain('Acme')
  })

  it("instructs the model to be neutral and factual, not judgemental", async () => {
    mockGeminiText('Anything.')
    await summarizeCandidate(richInput())
    const sentPrompt = generateContentMock.mock.calls[0][0] as string

    // Guard against prompt drift that would push the model toward
    // judgement / decision language — the design principle (assistant only).
    expect(sentPrompt.toLowerCase()).toContain('neutral')
    expect(sentPrompt.toLowerCase()).toContain('factual')
    expect(sentPrompt.toLowerCase()).toMatch(/do not.*judg|do not.*decid|do not.*recommend/)
  })

  it('returns failed when both models return empty strings (no fabrication path)', async () => {
    mockGeminiText('')
    mockGeminiText('   ')
    const result = await summarizeCandidate(richInput())
    expect(result.ok).toBe(false)
  })
})
