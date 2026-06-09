import { GoogleGenerativeAI } from '@google/generative-ai'
import * as Sentry from '@sentry/nextjs'

// Seventh feature in lib/ai/. Same Gemini, same fallback, same fail-soft return
// shape as the others. Like candidate-summary and note-extractor, this feature
// DOES send candidate-identifying data (first name + role title), but it does
// NOT send email/phone/LinkedIn/DOB. The recruiter's free-text context may
// contain anything; prompt rules tell the model to ignore protected info.

const EMAIL_TIMEOUT_MS = 25_000
const RETRY_DELAY_MS = 1_500
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const

export const EMAIL_TYPES = [
  'rejection',
  'interview_invite',
  'offer',
  'follow_up',
  'custom',
] as const
export type EmailType = (typeof EMAIL_TYPES)[number]

export const EMAIL_MODES = ['generate', 'improve'] as const
export type EmailMode = (typeof EMAIL_MODES)[number]

/** Subject + body limits keep the response within sane email lengths and bound
 * the recruiter's review effort. The body is plain text — UI shows it in a
 * pre-wrapped block; recruiter copies it into Gmail / their email tool. */
const MAX_SUBJECT_LENGTH = 200
const MAX_BODY_LENGTH = 4000

export interface EmailDrafterInput {
  type: EmailType
  mode: EmailMode
  candidate_first_name: string
  /** Optional — the role title the email is about. If null, the email is generic. */
  role_title: string | null
  /** Recruiter's first name, used for the sign-off. Optional. */
  sender_first_name: string | null
  /** For mode = 'improve': recruiter's draft text. Required when mode is improve. */
  draft: string | null
  /** Free-text context the recruiter adds to steer the AI. Optional. */
  additional_context: string | null
}

export interface DraftedEmail {
  subject: string
  body: string
}

export type EmailDrafterResult =
  | { ok: true; email: DraftedEmail }
  | {
      ok: false
      reason: 'too_thin' | 'timeout' | 'failed' | 'no_key' | 'malformed'
    }

const RULES = `Strict rules:
- Tone is professional, warm, and respectful. Never condescending. Never overly familiar.
- Use ONLY the candidate's first name for personalization (never invent a last name or any other detail not provided).
- NEVER reference protected characteristics (age, gender, race, ethnicity, religion, national origin, family or marital status, pregnancy, sexual orientation, disability, political views).
- NEVER invent specific facts not in the input: interview dates, salary numbers, start dates, team names, office locations, product names. If a date or detail isn't provided, use a clear placeholder like [INTERVIEW DATE] or [SALARY] for the recruiter to fill.
- NEVER promise outcomes the recruiter hasn't authorised (e.g. don't write "you got the job" in a follow-up email).
- For rejection emails: be warm and respectful, do not over-explain, do not invite re-application unless the recruiter's context asks for it.
- For interview invites: cover what (interview round), when (placeholder if not given), how long, format (video/onsite/phone — placeholder if not given), and what to prepare.
- For offer emails: keep it as a verbal-offer-style note. Do NOT write a binding contract. Use placeholders for compensation, start date, and benefits unless the recruiter's context supplies them.
- For follow-up emails: short, no pressure on the candidate.
- For improve mode: keep the recruiter's intent and key points. Tighten language, fix tone issues, fix grammar. Do NOT change the meaning.
- For improve mode: if the recruiter's draft contains anything obviously inappropriate (protected-class reference, salary leak the recruiter shouldn't share, etc.), silently rewrite to remove it.
- Sign off with the sender's first name if provided, otherwise leave a "[YOUR NAME]" placeholder.
- If the input is too sparse to produce a useful email (e.g. mode is improve but draft is empty, or generate with no candidate name and no role and no context), output exactly: TOO_THIN`

const OUTPUT_FORMAT = `Output strictly as JSON with this exact shape — no preamble, no markdown fence, no commentary:

{
  "subject": "Short, clear subject line",
  "body": "Plain-text email body, with line breaks as \\n. Include a greeting, body paragraphs, and a sign-off."
}`

const TYPE_FRAMING: Record<EmailType, string> = {
  rejection:
    'This is a rejection email — the candidate will not be moving forward with this role.',
  interview_invite:
    'This is an interview-invite email — the recruiter wants to schedule the next round.',
  offer:
    'This is an offer email — a soft, verbal-offer-style note inviting the candidate to a final conversation about an offer. NOT a contract.',
  follow_up:
    'This is a follow-up email — a polite, low-pressure check-in (e.g. after a delay, after sending materials, etc.).',
  custom:
    'This is a custom email — the type and intent come from the recruiter context. Use neutral, professional framing.',
}

function buildPrompt(input: EmailDrafterInput): string {
  const candidate = input.candidate_first_name.trim() || 'the candidate'
  const sender = input.sender_first_name?.trim() || null

  const facts: string[] = []
  facts.push(`Candidate first name: ${candidate}`)
  if (input.role_title?.trim()) facts.push(`Role: ${input.role_title.trim()}`)
  if (sender) facts.push(`Sender first name (for sign-off): ${sender}`)
  facts.push(`Email type: ${input.type}`)
  facts.push(`Mode: ${input.mode}`)
  if (input.additional_context?.trim()) {
    facts.push(`Recruiter context / notes:\n${input.additional_context.trim()}`)
  }
  if (input.mode === 'improve' && input.draft?.trim()) {
    facts.push(`Recruiter's current draft (to improve):\n${input.draft.trim()}`)
  }

  return [
    'You are a recruiting copilot helping a recruiter draft a candidate email.',
    TYPE_FRAMING[input.type],
    input.mode === 'improve'
      ? "The recruiter has written a draft and wants you to improve it without changing the intent."
      : 'The recruiter wants a fresh draft they can edit before sending.',
    '',
    RULES,
    '',
    OUTPUT_FORMAT,
    '',
    'Inputs:',
    facts.join('\n'),
  ].join('\n')
}

function isTooThin(input: EmailDrafterInput): boolean {
  // Improve mode requires an actual draft to improve.
  if (input.mode === 'improve') {
    const draft = (input.draft ?? '').trim()
    if (draft.length < 20) return true
  }
  // Generate mode needs SOMETHING — either a role, or a context note, or both.
  // First name alone with no role and no context produces generic slop.
  if (input.mode === 'generate') {
    const hasRole = (input.role_title ?? '').trim().length > 0
    const hasContext = (input.additional_context ?? '').trim().length > 0
    if (!hasRole && !hasContext) return true
  }
  return false
}

function parseEmail(text: string): DraftedEmail | null {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const obj = parsed as Record<string, unknown>
  if (typeof obj.subject !== 'string' || typeof obj.body !== 'string') return null

  const subject = obj.subject.trim()
  const body = obj.body.trim()
  if (subject.length === 0 || body.length === 0) return null
  if (subject.length > MAX_SUBJECT_LENGTH) return null
  if (body.length > MAX_BODY_LENGTH) return null

  return { subject, body }
}

async function callGeminiWithTimeout(
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string | { error: 'timeout' | 'failed' }> {
  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({ model: modelName })

  const timeout = new Promise<{ error: 'timeout' }>((resolve) =>
    setTimeout(() => resolve({ error: 'timeout' }), EMAIL_TIMEOUT_MS),
  )

  try {
    const result = await Promise.race([
      model.generateContent(prompt).then((r) => ({ text: r.response.text() })),
      timeout,
    ])
    if ('error' in result) return { error: 'timeout' }
    return result.text
  } catch (err) {
    console.error('[ai/email-drafter] gemini call failed:', err)
    Sentry.captureException(err, {
      tags: { feature: 'email_drafter', model: modelName },
    })
    return { error: 'failed' }
  }
}

/**
 * Draft a candidate email. Advisory only — output is never sent automatically.
 * The recruiter reviews subject + body, copies into their email tool, and sends
 * manually. Mode 'generate' produces a fresh draft from the inputs; mode
 * 'improve' rewrites the recruiter's draft, preserving intent.
 */
export async function draftCandidateEmail(
  input: EmailDrafterInput,
): Promise<EmailDrafterResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[ai/email-drafter] GOOGLE_GEMINI_API_KEY not configured')
    return { ok: false, reason: 'no_key' }
  }

  if (isTooThin(input)) {
    return { ok: false, reason: 'too_thin' }
  }

  const prompt = buildPrompt(input)

  for (let i = 0; i < MODELS.length; i++) {
    const modelName = MODELS[i]
    const result = await callGeminiWithTimeout(apiKey, modelName, prompt)

    if (typeof result === 'string') {
      const trimmed = result.trim()
      if (trimmed === 'TOO_THIN') return { ok: false, reason: 'too_thin' }
      const parsed = parseEmail(trimmed)
      if (parsed) return { ok: true, email: parsed }
      if (i === MODELS.length - 1) return { ok: false, reason: 'malformed' }
    } else if (i === MODELS.length - 1) {
      return { ok: false, reason: result.error }
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }

  return { ok: false, reason: 'failed' }
}
