import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { generateContentMock, getGenerativeModelMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn()
  const getGenerativeModelMock = vi.fn(() => ({
    generateContent: generateContentMock,
  }))
  return { generateContentMock, getGenerativeModelMock }
})

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: function MockGenerativeAI(this: {
    getGenerativeModel: typeof getGenerativeModelMock
  }) {
    this.getGenerativeModel = getGenerativeModelMock
  },
}))

import {
  generateJobDescriptionSection,
  type JdGeneratorInput,
} from '@/lib/ai/jd-generator'

const ORIGINAL_KEY = process.env.GOOGLE_GEMINI_API_KEY

function richInput(overrides: Partial<JdGeneratorInput> = {}): JdGeneratorInput {
  return {
    title: 'Senior Backend Engineer',
    department: 'Engineering',
    location: 'Tbilisi, Georgia',
    employment_type: 'full_time',
    sector_name: 'Technology',
    additional_context: null,
    ...overrides,
  }
}

function mockGeminiText(text: string) {
  generateContentMock.mockResolvedValueOnce({
    response: { text: () => text },
  })
}

describe('generateJobDescriptionSection', () => {
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
    const result = await generateJobDescriptionSection(richInput(), 'description')
    expect(result).toEqual({ ok: false, reason: 'no_key' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('returns too_thin for a single-word title with no other context (responsibilities)', async () => {
    const result = await generateJobDescriptionSection(
      {
        title: 'Dev',
        department: null,
        location: null,
        employment_type: null,
        sector_name: null,
        additional_context: null,
      },
      'responsibilities',
    )
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('returns too_thin for a single-word title with no context (description)', async () => {
    const result = await generateJobDescriptionSection(
      {
        title: 'Dev',
        department: null,
        location: null,
        employment_type: null,
        sector_name: null,
        additional_context: null,
      },
      'description',
    )
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
  })

  it('returns the generated text on a successful Gemini response', async () => {
    mockGeminiText('The role involves leading backend architecture decisions.')
    const result = await generateJobDescriptionSection(richInput(), 'description')
    expect(result).toEqual({
      ok: true,
      section: 'description',
      text: 'The role involves leading backend architecture decisions.',
    })
  })

  it("returns too_thin when the model itself says 'TOO_THIN'", async () => {
    mockGeminiText('TOO_THIN')
    const result = await generateJobDescriptionSection(richInput(), 'description')
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
  })

  it('falls back to the second model when the first fails', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('first down'))
    mockGeminiText('From the fallback model.')
    const result = await generateJobDescriptionSection(richInput(), 'responsibilities')
    expect(result).toEqual({
      ok: true,
      section: 'responsibilities',
      text: 'From the fallback model.',
    })
    expect(generateContentMock).toHaveBeenCalledTimes(2)
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(1, { model: 'gemini-2.5-flash' })
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(2, { model: 'gemini-2.5-flash-lite' })
  })

  it('returns failed when both models throw', async () => {
    generateContentMock.mockRejectedValue(new Error('down'))
    const result = await generateJobDescriptionSection(richInput(), 'requirements')
    expect(result).toEqual({ ok: false, reason: 'failed' })
  })

  it('encodes the recruiter additional_context in the prompt when provided', async () => {
    mockGeminiText('A response.')
    await generateJobDescriptionSection(
      richInput({ additional_context: 'Must know Kubernetes' }),
      'description',
    )
    const sent = generateContentMock.mock.calls[0][0] as string
    expect(sent).toContain('Must know Kubernetes')
  })

  it('instructs the model to avoid bias / hype language', async () => {
    mockGeminiText('A response.')
    await generateJobDescriptionSection(richInput(), 'description')
    const sent = generateContentMock.mock.calls[0][0] as string
    // Guard the rule list against drift — these phrases keep the prompt safe.
    expect(sent).toMatch(/rockstar/i)
    expect(sent).toMatch(/ninja/i)
    expect(sent).toMatch(/avoid|do not invent/i)
    expect(sent).toMatch(/role-neutral/i)
  })

  it('asks the model to refuse fabrication when input is thin (TOO_THIN escape hatch)', async () => {
    mockGeminiText('A response.')
    await generateJobDescriptionSection(richInput(), 'responsibilities')
    const sent = generateContentMock.mock.calls[0][0] as string
    expect(sent).toContain('TOO_THIN')
  })

  it('returns failed when both models return empty strings (no fabrication path)', async () => {
    mockGeminiText('')
    mockGeminiText('   ')
    const result = await generateJobDescriptionSection(richInput(), 'description')
    expect(result.ok).toBe(false)
  })

  it('passes through the requested section in the success result', async () => {
    mockGeminiText('- First responsibility\n- Second responsibility')
    const result = await generateJobDescriptionSection(richInput(), 'responsibilities')
    expect(result).toMatchObject({ ok: true, section: 'responsibilities' })
  })
})
