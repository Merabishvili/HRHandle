import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// Constructor-style mock — vi.fn() with an arrow body isn't constructable, so
// we use a function-keyword implementation that sets fields on `this`. Same
// pattern as the other ai-*.test.ts files.
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
  extractStructuredNotes,
  MIN_NOTES_LENGTH,
  type NoteExtractorInput,
} from '@/lib/ai/note-extractor'

const ORIG_KEY = process.env.GOOGLE_GEMINI_API_KEY

function richInput(overrides: Partial<NoteExtractorInput> = {}): NoteExtractorInput {
  return {
    candidate_first_name: 'Alex',
    candidate_last_name: 'Smith',
    role_title: 'Senior Backend Engineer',
    raw_notes:
      'Alex talked about their work at a fintech startup, leading a team of four. ' +
      'Showed deep knowledge of PostgreSQL and Kubernetes. Was less confident about ' +
      'distributed systems at the multi-region level. Mentioned past experience ' +
      'mentoring two junior engineers and running incident reviews.',
    ...overrides,
  }
}

function geminiResponse(text: string) {
  return Promise.resolve({ response: { text: () => text } })
}

function validStructure() {
  return JSON.stringify({
    summary: 'Alex described their background at a fintech startup leading a team of four.',
    strengths: [
      'Deep PostgreSQL knowledge — referenced specific tuning work.',
      'Mentored two junior engineers.',
    ],
    concerns: ['Less confident on multi-region distributed systems.'],
    key_skills_demonstrated: [
      'PostgreSQL — described tuning at the startup.',
      'Kubernetes — used in production.',
    ],
    follow_ups: ['Probe multi-region failure-handling experience next round.'],
  })
}

describe('extractStructuredNotes', () => {
  beforeEach(() => {
    generateContentMock.mockReset()
    getGenerativeModelMock.mockClear()
    process.env.GOOGLE_GEMINI_API_KEY = 'test-key'
  })

  afterAll(() => {
    if (ORIG_KEY === undefined) delete process.env.GOOGLE_GEMINI_API_KEY
    else process.env.GOOGLE_GEMINI_API_KEY = ORIG_KEY
  })

  it('returns the structured output on a successful Gemini response', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse(validStructure()))
    const result = await extractStructuredNotes(richInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.structured.summary).toMatch(/Alex/)
      expect(result.structured.strengths.length).toBeGreaterThan(0)
      expect(result.structured.key_skills_demonstrated.length).toBeGreaterThan(0)
    }
  })

  it('treats the literal "TOO_THIN" sentinel as too_thin', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse('TOO_THIN'))
    const result = await extractStructuredNotes(richInput())
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
  })

  it('returns too_thin when raw notes are below MIN_NOTES_LENGTH', async () => {
    const result = await extractStructuredNotes(richInput({ raw_notes: 'too short' }))
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
    // Did not call Gemini at all
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('falls back to the second model when the first throws', async () => {
    generateContentMock
      .mockImplementationOnce(() => Promise.reject(new Error('model 1 down')))
      .mockReturnValueOnce(geminiResponse(validStructure()))
    const result = await extractStructuredNotes(richInput())
    expect(result.ok).toBe(true)
    expect(generateContentMock).toHaveBeenCalledTimes(2)
  })

  it('returns malformed when the model returns non-JSON', async () => {
    generateContentMock
      .mockReturnValueOnce(geminiResponse('Here is some prose, not JSON.'))
      .mockReturnValueOnce(geminiResponse('Still not JSON.'))
    const result = await extractStructuredNotes(richInput())
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('strips a ```json code fence before parsing', async () => {
    const fenced = '```json\n' + validStructure() + '\n```'
    generateContentMock.mockReturnValueOnce(geminiResponse(fenced))
    const result = await extractStructuredNotes(richInput())
    expect(result.ok).toBe(true)
  })

  it('returns malformed when summary is missing', async () => {
    const noSummary = JSON.stringify({
      strengths: ['x'],
      concerns: [],
      key_skills_demonstrated: [],
      follow_ups: [],
    })
    generateContentMock
      .mockReturnValueOnce(geminiResponse(noSummary))
      .mockReturnValueOnce(geminiResponse(noSummary))
    const result = await extractStructuredNotes(richInput())
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('returns malformed when every section is empty (no useful extraction)', async () => {
    const empty = JSON.stringify({
      summary: '',
      strengths: [],
      concerns: [],
      key_skills_demonstrated: [],
      follow_ups: [],
    })
    generateContentMock
      .mockReturnValueOnce(geminiResponse(empty))
      .mockReturnValueOnce(geminiResponse(empty))
    const result = await extractStructuredNotes(richInput())
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('returns ok when only the summary is present (empty arrays allowed)', async () => {
    const summaryOnly = JSON.stringify({
      summary: 'A short summary line.',
      strengths: [],
      concerns: [],
      key_skills_demonstrated: [],
      follow_ups: [],
    })
    generateContentMock.mockReturnValueOnce(geminiResponse(summaryOnly))
    const result = await extractStructuredNotes(richInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.structured.summary).toBe('A short summary line.')
      expect(result.structured.strengths).toEqual([])
    }
  })

  it('returns no_key when GOOGLE_GEMINI_API_KEY is unset', async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY
    const result = await extractStructuredNotes(richInput())
    expect(result).toEqual({ ok: false, reason: 'no_key' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('builds a prompt that names the candidate and role, includes the safety guards, and quotes the notes verbatim', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse(validStructure()))
    await extractStructuredNotes(richInput())
    const prompt = generateContentMock.mock.calls[0][0] as string
    expect(prompt).toMatch(/Alex Smith/)
    expect(prompt).toMatch(/Senior Backend Engineer/)
    // Protected-class guard
    expect(prompt).toMatch(/protected characteristics/i)
    // No hiring recommendation
    expect(prompt).toMatch(/NEVER make a hiring recommendation/i)
    // No salary in output
    expect(prompt).toMatch(/salary/i)
    // Notes verbatim
    expect(prompt).toMatch(/fintech startup/)
    // TOO_THIN escape hatch
    expect(prompt).toMatch(/TOO_THIN/)
  })

  it('drops trailing whitespace before measuring against MIN_NOTES_LENGTH', async () => {
    const justOverWithPadding = ' '.repeat(50) + 'this part is only a few words' + ' '.repeat(20)
    // This trims to under MIN_NOTES_LENGTH → too_thin without calling Gemini.
    const result = await extractStructuredNotes(
      richInput({ raw_notes: justOverWithPadding }),
    )
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
    expect(generateContentMock).not.toHaveBeenCalled()
    // Sanity: confirm we crossed the trimmed/untrimmed boundary.
    expect(justOverWithPadding.trim().length).toBeLessThan(MIN_NOTES_LENGTH)
    expect(justOverWithPadding.length).toBeGreaterThan(MIN_NOTES_LENGTH)
  })
})
