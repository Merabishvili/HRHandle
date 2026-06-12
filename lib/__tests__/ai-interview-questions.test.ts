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
  generateInterviewQuestions,
  type InterviewQuestionsInput,
} from '@/lib/ai/interview-questions'

const ORIGINAL_KEY = process.env.GOOGLE_GEMINI_API_KEY

function richInput(
  overrides: Partial<InterviewQuestionsInput> = {},
): InterviewQuestionsInput {
  return {
    title: 'Senior Backend Engineer',
    description: 'Build distributed systems with PostgreSQL and Kubernetes.',
    responsibilities: '- Lead architecture\n- Mentor juniors',
    requirements: '- 5+ years TypeScript\n- Production K8s experience',
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

const VALID_RESPONSE = JSON.stringify({
  behavioural: [
    'Tell me about a time when you led a complex migration.',
    'Describe a time you mentored a junior engineer.',
    'Tell me about a production incident you owned.',
    'Describe a difficult technical disagreement and how you resolved it.',
  ],
  technical: [
    'How would you design a multi-tenant Postgres schema?',
    'Walk me through how you would diagnose latency in a Node.js service.',
    'What are the trade-offs between SQL and NoSQL for event storage?',
    'How would you set up Kubernetes resource limits for a stateful service?',
  ],
  situational: [
    'How would you handle a teammate who keeps missing deadlines?',
    'What would you do if you discovered a critical security flaw in production?',
    'How would you approach a project with unclear requirements?',
    'How would you decide whether to refactor or rewrite a service?',
  ],
  closing: [
    'What questions do you have for me about the role?',
    'What about this role attracted you?',
    'What would success in the first three months look like for you?',
    'Is there anything we have not covered that you want to share?',
  ],
})

describe('generateInterviewQuestions', () => {
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
    const result = await generateInterviewQuestions(richInput())
    expect(result).toEqual({ ok: false, reason: 'no_key' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('returns too_thin for a single-character title', async () => {
    const result = await generateInterviewQuestions(
      richInput({
        title: 'X',
        description: null,
        responsibilities: null,
        requirements: null,
        department: null,
        location: null,
        employment_type: null,
        sector_name: null,
      }),
    )
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
    expect(generateContentMock).not.toHaveBeenCalled()
  })

  it('returns parsed questions on a successful Gemini response', async () => {
    mockGeminiText(VALID_RESPONSE)
    const result = await generateInterviewQuestions(richInput())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.questions.behavioural).toHaveLength(4)
    expect(result.questions.technical).toHaveLength(4)
    expect(result.questions.situational).toHaveLength(4)
    expect(result.questions.closing).toHaveLength(4)
  })

  it('strips a json markdown fence if Gemini includes one', async () => {
    mockGeminiText('```json\n' + VALID_RESPONSE + '\n```')
    const result = await generateInterviewQuestions(richInput())
    expect(result.ok).toBe(true)
  })

  it("returns too_thin when the model itself says 'TOO_THIN'", async () => {
    mockGeminiText('TOO_THIN')
    const result = await generateInterviewQuestions(richInput())
    expect(result).toEqual({ ok: false, reason: 'too_thin' })
  })

  it('returns malformed when the model returns non-JSON', async () => {
    mockGeminiText('Here are the questions you asked for!')
    mockGeminiText('Still not JSON.')
    const result = await generateInterviewQuestions(richInput())
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('returns malformed when JSON is missing a required category', async () => {
    mockGeminiText(
      JSON.stringify({
        behavioural: ['Q1'],
        technical: ['Q1'],
        situational: ['Q1'],
        // closing missing
      }),
    )
    mockGeminiText(
      JSON.stringify({
        behavioural: ['Q1'],
        technical: ['Q1'],
        situational: ['Q1'],
      }),
    )
    const result = await generateInterviewQuestions(richInput())
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('returns malformed when every category is empty', async () => {
    mockGeminiText(
      JSON.stringify({
        behavioural: [],
        technical: [],
        situational: [],
        closing: [],
      }),
    )
    mockGeminiText(
      JSON.stringify({
        behavioural: [],
        technical: [],
        situational: [],
        closing: [],
      }),
    )
    const result = await generateInterviewQuestions(richInput())
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('falls back to the second model when the first throws', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('first down'))
    mockGeminiText(VALID_RESPONSE)
    const result = await generateInterviewQuestions(richInput())
    expect(result.ok).toBe(true)
    expect(generateContentMock).toHaveBeenCalledTimes(2)
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(1, { model: 'gemini-2.5-flash' })
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(2, { model: 'gemini-2.5-flash-lite' })
  })

  it('returns failed when both models throw', async () => {
    generateContentMock.mockRejectedValue(new Error('down'))
    const result = await generateInterviewQuestions(richInput())
    expect(result).toEqual({ ok: false, reason: 'failed' })
  })

  it('encodes additional_context in the prompt', async () => {
    mockGeminiText(VALID_RESPONSE)
    await generateInterviewQuestions(
      richInput({ additional_context: 'Focus on system-design depth.' }),
    )
    const sent = generateContentMock.mock.calls[0]![0] as string
    expect(sent).toContain('Focus on system-design depth.')
  })

  it('instructs the model to avoid protected-class probing', async () => {
    mockGeminiText(VALID_RESPONSE)
    await generateInterviewQuestions(richInput())
    const sent = generateContentMock.mock.calls[0]![0] as string
    // Critical guard. If anyone weakens these instructions, this test fails.
    expect(sent.toLowerCase()).toContain('protected characteristics')
    expect(sent.toLowerCase()).toContain('age')
    expect(sent.toLowerCase()).toContain('gender')
    expect(sent.toLowerCase()).toContain('religion')
    expect(sent.toLowerCase()).toContain('disability')
    expect(sent.toLowerCase()).toContain('salary')
  })

  it('asks the model to refuse fabrication when input is thin', async () => {
    mockGeminiText(VALID_RESPONSE)
    await generateInterviewQuestions(richInput())
    const sent = generateContentMock.mock.calls[0]![0] as string
    expect(sent).toContain('TOO_THIN')
  })
})
