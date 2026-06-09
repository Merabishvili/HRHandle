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
  draftCandidateEmail,
  type EmailDrafterInput,
} from '@/lib/ai/email-drafter'

const ORIG_KEY = process.env.GOOGLE_GEMINI_API_KEY

function genInput(
  overrides: Partial<EmailDrafterInput> = {},
): EmailDrafterInput {
  return {
    type: 'interview_invite',
    mode: 'generate',
    candidate_first_name: 'Anika',
    role_title: 'Senior Backend Engineer',
    sender_first_name: 'Alex',
    draft: null,
    additional_context: 'Round 2 — system design. 60 minutes on Google Meet.',
    ...overrides,
  }
}

function improveInput(
  overrides: Partial<EmailDrafterInput> = {},
): EmailDrafterInput {
  return {
    type: 'rejection',
    mode: 'improve',
    candidate_first_name: 'Anika',
    role_title: 'Senior Backend Engineer',
    sender_first_name: 'Alex',
    draft:
      'Hi Anika, thanks for applying. We decided to go with another candidate. Best of luck.',
    additional_context: null,
    ...overrides,
  }
}

function geminiResponse(text: string) {
  return Promise.resolve({ response: { text: () => text } })
}

function validPayload() {
  return JSON.stringify({
    subject: 'Round 2 interview — Senior Backend Engineer',
    body: 'Hi Anika,\n\nThanks for your time so far. We would like to invite you to a 60-minute system-design round on [INTERVIEW DATE] via Google Meet.\n\nBest,\nAlex',
  })
}

describe('draftCandidateEmail', () => {
  beforeEach(() => {
    generateContentMock.mockReset()
    getGenerativeModelMock.mockClear()
    process.env.GOOGLE_GEMINI_API_KEY = 'test-key'
  })

  afterAll(() => {
    if (ORIG_KEY === undefined) delete process.env.GOOGLE_GEMINI_API_KEY
    else process.env.GOOGLE_GEMINI_API_KEY = ORIG_KEY
  })

  it('returns parsed subject + body on a successful Gemini response', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse(validPayload()))
    const result = await draftCandidateEmail(genInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.email.subject).toMatch(/Senior Backend Engineer/)
      expect(result.email.body).toMatch(/Anika/)
      expect(result.email.body).toMatch(/Alex/)
    }
  })

  it('returns too_thin when generate mode has no role and no context', async () => {
    const result = await draftCandidateEmail(
      genInput({ role_title: null, additional_context: null }),
    )
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('returns too_thin when improve mode has no draft', async () => {
    const result = await draftCandidateEmail(improveInput({ draft: '' }))
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('returns too_thin when improve mode has a draft under 20 chars', async () => {
    const result = await draftCandidateEmail(improveInput({ draft: 'too short' }))
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('returns too_thin when the model emits the TOO_THIN sentinel', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse('TOO_THIN'))
    const result = await draftCandidateEmail(genInput())
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
  })

  it('falls back to the second model when the first throws', async () => {
    generateContentMock
      .mockImplementationOnce(() => Promise.reject(new Error('model 1 down')))
      .mockReturnValueOnce(geminiResponse(validPayload()))
    const result = await draftCandidateEmail(genInput())
    expect(result.ok).toBe(true)
    expect(generateContentMock).toHaveBeenCalledTimes(2)
  })

  it('returns malformed when both models return non-JSON', async () => {
    generateContentMock
      .mockReturnValueOnce(geminiResponse('Not JSON.'))
      .mockReturnValueOnce(geminiResponse('Still not JSON.'))
    const result = await draftCandidateEmail(genInput())
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('returns malformed when the body or subject is empty', async () => {
    const payload = JSON.stringify({ subject: '', body: 'some body' })
    generateContentMock
      .mockReturnValueOnce(geminiResponse(payload))
      .mockReturnValueOnce(geminiResponse(payload))
    const result = await draftCandidateEmail(genInput())
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('strips a ```json code fence before parsing', async () => {
    const fenced = '```json\n' + validPayload() + '\n```'
    generateContentMock.mockReturnValueOnce(geminiResponse(fenced))
    const result = await draftCandidateEmail(genInput())
    expect(result.ok).toBe(true)
  })

  it('returns no_key when GOOGLE_GEMINI_API_KEY is unset', async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY
    const result = await draftCandidateEmail(genInput())
    expect(result).toEqual({ ok: false, reason: 'no_key' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('builds a generate-mode prompt that includes the type framing and the rules', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse(validPayload()))
    await draftCandidateEmail(genInput())
    const prompt = generateContentMock.mock.calls[0][0] as string

    expect(prompt).toMatch(/interview-invite email/i)
    expect(prompt).toMatch(/Anika/)
    expect(prompt).toMatch(/Senior Backend Engineer/)
    expect(prompt).toMatch(/Round 2 — system design/)
    // Protected-class guard
    expect(prompt).toMatch(/protected characteristics/i)
    // No-fabrication guard
    expect(prompt).toMatch(/invent specific facts/i)
    // TOO_THIN escape hatch
    expect(prompt).toMatch(/TOO_THIN/)
    // Sender for sign-off
    expect(prompt).toMatch(/Sender first name/)
  })

  it('builds an improve-mode prompt that includes the recruiter draft', async () => {
    generateContentMock.mockReturnValueOnce(geminiResponse(validPayload()))
    await draftCandidateEmail(improveInput())
    const prompt = generateContentMock.mock.calls[0][0] as string

    expect(prompt).toMatch(/improve it without changing the intent/i)
    expect(prompt).toMatch(/rejection email/i)
    expect(prompt).toMatch(/Recruiter's current draft/)
    expect(prompt).toMatch(/thanks for applying/)
  })
})
