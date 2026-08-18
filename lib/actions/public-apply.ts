'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendApplicationConfirmationEmail } from '@/lib/email'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { dispatchWebhookNotification } from '@/lib/notifications/webhook-dispatcher'
import { applicationReceivedCtx } from '@/lib/notifications/event-builders'
import { createOrgNotifications } from '@/lib/actions/notifications'
import { verifyCaptcha } from '@/lib/turnstile'
import { computeIsKnockoutFlag } from '@/lib/screening-questions/compute-flag'
import { resolvePipelineStageId } from '@/lib/pipeline-stages/resolve'
import { justCrossedLimit } from '@/lib/plan-limits'
import { headers } from 'next/headers'

const MAX_SUBMISSIONS_PER_IP_PER_HOUR = 5
const MAX_APPLICATIONS_PER_VACANCY = 500
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

// Magic byte signatures to verify files aren't just renamed with a trusted extension
const MAGIC_NUMBERS = [
  { bytes: [0x25, 0x50, 0x44, 0x46] },                                    // %PDF
  { bytes: [0x50, 0x4b, 0x03, 0x04] },                                    // PK (ZIP / DOCX)
  { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },          // OLE2 (DOC)
]

function hasValidMagicNumber(buf: ArrayBuffer): boolean {
  const view = new Uint8Array(buf, 0, 8)
  return MAGIC_NUMBERS.some(({ bytes }) => bytes.every((b, i) => view[i] === b))
}

// Gemini returns dates as "YYYY-MM" — PostgreSQL DATE requires "YYYY-MM-DD"
function toDateString(date: string | null): string | null {
  if (!date) return null
  return /^\d{4}-\d{2}$/.test(date) ? `${date}-01` : date
}

export type PublicApplyResult =
  // statusToken is optional because two success paths don't surface a
  // tracker link: the silent honeypot drop (bot — no application created)
  // and any path where we don't want to expose the existing application
  // to a re-submitter.
  | { success: true; statusToken?: string }
  | { success: false; error: string }

export async function submitPublicApplication(
  formData: FormData
): Promise<PublicApplyResult> {
  // The apply form is unauthenticated — applicants have no Supabase session,
  // so RLS-protected writes on candidates/applications cannot use the anon
  // client. Access is gated by:
  //   - Cloudflare Turnstile (step 1b, when TURNSTILE_SECRET_KEY is set)
  //   - The `application_form_token` validated against `vacancies` (step 5);
  //     no DB write happens before that check passes
  //   - Per-IP and per-vacancy rate limits (steps 6–7)
  // See docs/issues-found.md S-010 for the threat-model rationale.
  const supabase = createAdminClient()

  // ── 1. Honeypot ────────────────────────────────────────────────────────────
  const honeypot = formData.get('website') as string | null
  if (honeypot) return { success: true } // silently drop bots

  // ── 1b. Captcha verification ───────────────────────────────────────────────
  const captchaToken = formData.get('cf_turnstile_token') as string | null
  const captchaHeaders = await headers()
  const captchaIp =
    captchaHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    captchaHeaders.get('x-real-ip') ||
    null
  const captchaOk = await verifyCaptcha(captchaToken, captchaIp)
  if (!captchaOk) {
    return { success: false, error: 'Security check failed. Please refresh and try again.' }
  }

  // ── 2. Read fields ─────────────────────────────────────────────────────────
  const token = formData.get('token') as string | null
  const firstName = (formData.get('first_name') as string | null)?.trim()
  const lastName = (formData.get('last_name') as string | null)?.trim()
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const phone = (formData.get('phone') as string | null)?.trim() || null
  const linkedinUrl = (formData.get('linkedin_profile_url') as string | null)?.trim() || null
  const cvFile = formData.get('cv') as File | null
  const experienceJson = (formData.get('experience_json') as string | null) || '[]'
  const educationJson = (formData.get('education_json') as string | null) || '[]'
  // Wave 2.5 Slice 2b — recruiter-defined screening questions. The form
  // posts an array of { question_id, answer_value } objects.
  const screeningAnswersJson =
    (formData.get('screening_answers_json') as string | null) || '[]'

  // ── 3. Basic validation ────────────────────────────────────────────────────
  if (!token) return { success: false, error: 'Invalid form link.' }
  if (!firstName) return { success: false, error: 'First name is required.' }
  if (!lastName) return { success: false, error: 'Last name is required.' }
  if (!email || !z.string().email().safeParse(email).success) {
    return { success: false, error: 'A valid email address is required.' }
  }
  // ── 4. File validation (only when a file was provided) ────────────────────
  let fileBytes: ArrayBuffer | null = null
  if (cvFile && cvFile.size > 0) {
    if (!ALLOWED_MIME_TYPES.includes(cvFile.type)) {
      return { success: false, error: 'CV must be a PDF or Word document.' }
    }
    if (cvFile.size > MAX_FILE_BYTES) {
      return { success: false, error: 'CV file must be 10 MB or smaller.' }
    }
    fileBytes = await cvFile.arrayBuffer()
    if (!hasValidMagicNumber(fileBytes)) {
      return { success: false, error: 'CV must be a valid PDF or Word document.' }
    }
  }

  // ── 5. Resolve vacancy from token ─────────────────────────────────────────
  const { data: vacancy } = await supabase
    .from('vacancies')
    .select(`
      id,
      organization_id,
      title,
      archived_at,
      vacancy_statuses ( code )
    `)
    .eq('application_form_token', token)
    .is('deleted_at', null)
    .single()

  if (!vacancy) return { success: false, error: 'This apply link is no longer active.' }

  // Vacancy must be open (draft/on_hold/closed/archived are all blocked)
  type StatusJoin = { code: string } | { code: string }[] | null
  const statusJoin = vacancy.vacancy_statuses as StatusJoin
  const statusCode = Array.isArray(statusJoin) ? statusJoin[0]?.code : statusJoin?.code
  if (vacancy.archived_at || statusCode !== 'open') {
    return { success: false, error: 'This position is no longer open.' }
  }

  const orgId: string = vacancy.organization_id

  // ── 6. Submission cap per vacancy ─────────────────────────────────────────
  const { count: appCount } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('vacancy_id', vacancy.id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if ((appCount ?? 0) >= MAX_APPLICATIONS_PER_VACANCY) {
    return { success: false, error: 'This position is no longer open.' }
  }

  // ── 7. IP rate limiting ────────────────────────────────────────────────────
  const headersList = await headers()
  const ipRaw =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'

  if (ipRaw !== 'unknown') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ipRaw)
      .gte('created_at', oneHourAgo)

    if ((recentCount ?? 0) >= MAX_SUBMISSIONS_PER_IP_PER_HOUR) {
      return { success: false, error: 'Too many submissions. Please try again later.' }
    }
  }

  // ── 8. Resolve active candidate general status id ─────────────────────────
  const { data: activeStatus } = await supabase
    .from('candidate_statuses')
    .select('id')
    .eq('code', 'active')
    .single()

  if (!activeStatus) {
    // The 'active' candidate status is seeded globally — its absence indicates
    // a misconfigured DB. Fail loudly rather than silently dropping all matches
    // via `.eq('general_status_id', '')` further down (audit B-004).
    console.error('[public-apply] missing candidate_statuses row for code=active')
    return { success: false, error: 'Application could not be processed. Please try again later.' }
  }

  // ── 9. Duplicate detection (email match is sufficient — phone is optional) ─
  let candidateId: string
  let isNewCandidate = false

  const { data: matchedCandidate } = await supabase
    .from('candidates')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', email)
    .eq('general_status_id', activeStatus.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (matchedCandidate) {
    candidateId = matchedCandidate.id

    // Already applied to this vacancy — silently succeed (same UX for the applicant)
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('organization_id', orgId)
      .eq('candidate_id', candidateId)
      .eq('vacancy_id', vacancy.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingApp) {
      return { success: true }
    }
  } else {
    // ── 10. Create new candidate ─────────────────────────────────────────────
    const { data: newCandidate, error: candidateError } = await supabase
      .from('candidates')
      .insert({
        organization_id: orgId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        linkedin_profile_url: linkedinUrl || null,
        source: 'Public Form',
        general_status_id: activeStatus.id,
      })
      .select('id')
      .single()

    if (candidateError || !newCandidate) {
      return { success: false, error: 'Failed to submit application. Please try again.' }
    }

    candidateId = newCandidate.id
    isNewCandidate = true
  }

  // ── 11. Create application ─────────────────────────────────────────────────
  // public_token is the candidate-facing status page key (G-016). Generated
  // here at INSERT time so the link goes into the confirmation email below.
  // Wave 2.6 Slice 4 — only pipeline_stage_id is set now (status_id is gone);
  // resolve the vacancy's per-vacancy "Applied" stage via the shared helper.
  const pipelineStageId = await resolvePipelineStageId(
    supabase,
    vacancy.id as string,
    'applied',
  )
  const publicToken = crypto.randomUUID().replace(/-/g, '')
  const { data: newApp, error: appError } = await supabase
    .from('applications')
    .insert({
      organization_id: orgId,
      candidate_id: candidateId,
      vacancy_id: vacancy.id,
      pipeline_stage_id: pipelineStageId,
      ip_address: ipRaw !== 'unknown' ? ipRaw : null,
      source_type: 'public_form',
      public_token: publicToken,
    })
    .select('id, public_token')
    .single()

  if (appError || !newApp) {
    // Roll back newly-created candidate to avoid orphaned records
    if (isNewCandidate) {
      await supabase.from('candidates').delete().eq('id', candidateId)
    }
    return { success: false, error: 'Failed to submit application. Please try again.' }
  }

  // ── 13. Save parsed experience + education (best-effort, non-fatal) ─────────
  // Zod-parse before persisting — schema matches what the parse-cv API produces
  // (lib/validations/candidate-background.ts ParsedCVSchema inner objects).
  if (isNewCandidate) {
    const PublicExperienceItem = z.object({
      company: z.string().min(1).max(200),
      title: z.string().min(1).max(200),
      start_date: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
      is_current: z.boolean().default(false),
      description: z.string().max(1000).nullable().optional(),
    })
    const PublicEducationItem = z.object({
      institution: z.string().min(1).max(200),
      degree: z.string().max(100).nullable().optional(),
      field_of_study: z.string().max(200).nullable().optional(),
      start_year: z.number().int().min(1900).max(new Date().getFullYear() + 1).nullable().optional(),
      end_year: z.number().int().min(1900).max(new Date().getFullYear() + 10).nullable().optional(),
      is_ongoing: z.boolean().default(false),
    })

    try {
      const parsed = z.array(PublicExperienceItem).safeParse(JSON.parse(experienceJson))
      if (parsed.success && parsed.data.length > 0) {
        const rows = parsed.data.map((e) => ({
          organization_id: orgId,
          candidate_id: candidateId,
          company: e.company,
          title: e.title,
          start_date: toDateString(e.start_date ?? null),
          end_date: toDateString(e.end_date ?? null),
          is_current: e.is_current,
          description: e.description ?? null,
        }))
        const { error: expErr } = await supabase.from('candidate_experience').insert(rows)
        if (expErr) console.error('[public-apply] experience insert failed:', expErr)
      } else if (!parsed.success) {
        console.warn('[public-apply] experience JSON failed validation:', parsed.error.issues[0]?.message)
      }
    } catch (err) {
      console.error('[public-apply] experience parse error:', err)
    }

    try {
      const parsed = z.array(PublicEducationItem).safeParse(JSON.parse(educationJson))
      if (parsed.success && parsed.data.length > 0) {
        const rows = parsed.data.map((e) => ({
          organization_id: orgId,
          candidate_id: candidateId,
          institution: e.institution,
          degree: e.degree ?? null,
          field_of_study: e.field_of_study ?? null,
          start_year: e.start_year ?? null,
          end_year: e.end_year ?? null,
          is_ongoing: e.is_ongoing,
        }))
        const { error: eduErr } = await supabase.from('candidate_education').insert(rows)
        if (eduErr) console.error('[public-apply] education insert failed:', eduErr)
      } else if (!parsed.success) {
        console.warn('[public-apply] education JSON failed validation:', parsed.error.issues[0]?.message)
      }
    } catch (err) {
      console.error('[public-apply] education parse error:', err)
    }
  }

  // ── 14. Persist screening answers (best-effort, non-fatal) ─────────────────
  // Match each submitted answer to a question in the same vacancy and
  // pre-compute the knockout flag using the shared helper. Rows whose
  // question_id doesn't belong to this vacancy are dropped silently — the
  // form should never send unknown ids, but if the questions were edited
  // between the page render and submit we'd rather drop the answer than
  // attach it to the wrong question.
  try {
    const ScreeningAnswerItem = z.object({
      question_id: z.string().uuid(),
      answer_value: z.string().max(500),
    })
    const parsed = z.array(ScreeningAnswerItem).safeParse(JSON.parse(screeningAnswersJson))
    if (parsed.success && parsed.data.length > 0) {
      const submittedIds = parsed.data.map((a) => a.question_id)
      const { data: matchedQuestions } = await supabase
        .from('vacancy_screening_questions')
        .select('id, is_knockout, knockout_answer, answer_type')
        .eq('vacancy_id', vacancy.id)
        .in('id', submittedIds)

      const questionById = new Map(
        (matchedQuestions ?? []).map((q) => [q.id as string, q]),
      )

      const rows = parsed.data
        .map((a) => {
          const q = questionById.get(a.question_id)
          if (!q) return null
          const answerValue = a.answer_value.trim() || null
          return {
            organization_id: orgId,
            application_id: newApp.id as string,
            question_id: q.id as string,
            answer_value: answerValue,
            is_knockout_flag: computeIsKnockoutFlag(
              {
                is_knockout: q.is_knockout as boolean,
                knockout_answer: (q.knockout_answer as string | null) ?? null,
                answer_type:
                  (q.answer_type as
                    | 'yes_no'
                    | 'short_text'
                    | 'number'
                    | 'select'
                    | undefined) ?? 'yes_no',
              },
              answerValue,
            ),
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      if (rows.length > 0) {
        const { error: answersErr } = await supabase
          .from('application_screening_answers')
          .insert(rows)
        if (answersErr) {
          console.error('[public-apply] screening answers insert failed:', answersErr)
        }
      }
    } else if (!parsed.success) {
      console.warn(
        '[public-apply] screening_answers JSON failed validation:',
        parsed.error.issues[0]?.message,
      )
    }
  } catch (err) {
    console.error('[public-apply] screening answers block error:', err)
  }

  // ── 15. Upload CV (optional) ───────────────────────────────────────────────
  if (cvFile && cvFile.size > 0 && fileBytes) {
    try {
      const rawExt = cvFile.name.split('.').pop()?.toLowerCase() ?? ''
      const ext = ['pdf', 'doc', 'docx'].includes(rawExt) ? rawExt : 'pdf'
      const storagePath = `${orgId}/${candidateId}/${crypto.randomUUID()}.${ext}`

      const { error: storageError } = await supabase.storage
        .from('candidate-documents')
        .upload(storagePath, fileBytes, {
          contentType: cvFile.type,
          upsert: false,
        })

      if (!storageError) {
        const { error: docError } = await supabase.from('candidate_documents').insert({
          organization_id: orgId,
          candidate_id: candidateId,
          uploaded_by: null,
          file_name: cvFile.name,
          file_size: cvFile.size,
          file_size_bytes: cvFile.size,
          mime_type: cvFile.type,
          file_path: storagePath,
          document_type: 'cv',
        })
        if (docError) console.error('[public-apply] candidate_documents insert failed:', docError)
      }
    } catch (err) {
      console.error('[public-apply] CV upload block error:', err)
    }
  }

  // ── 16. Notify org owners/admins of new application ───────────────────────
  try {
    const { data: orgMembers } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', orgId)
      .in('role', ['owner', 'admin'])

    const recipientIds = (orgMembers || []).map((m) => m.id)
    await createOrgNotifications(orgId, recipientIds, {
      type: 'new_application',
      title: `New application: ${firstName} ${lastName}`,
      body: `Applied for ${vacancy.title}`,
      link: `/vacancies/${vacancy.id}?tab=applications`,
    })
  } catch (err) {
    // Non-fatal: application has already been recorded.
    console.error('[public-apply] new-application notification failed:', err)
  }

  // ── 16b. Soft plan-limit flag (BL-203) ─────────────────────────────────────
  // Public applications are NEVER blocked (turning away a real applicant over a
  // billing cap is the wrong trade). But when a NEW candidate created via the
  // public form pushes the org past its `candidate_limit`, notify owners/admins
  // ONCE — at the crossing — so they can upgrade. Best-effort + non-fatal;
  // mirrors how `checkPlanLimit` counts (non-deleted candidates vs the sub cap).
  if (isNewCandidate) {
    try {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('candidate_limit')
        .eq('organization_id', orgId)
        .single()
      if (sub?.candidate_limit) {
        const { count } = await supabase
          .from('candidates')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('deleted_at', null)
        if (justCrossedLimit(count ?? 0, sub.candidate_limit)) {
          const { data: owners } = await supabase
            .from('profiles')
            .select('id')
            .eq('organization_id', orgId)
            .in('role', ['owner', 'admin'])
          const ownerIds = (owners ?? []).map((m) => m.id as string)
          await createOrgNotifications(orgId, ownerIds, {
            type: 'plan_limit_reached',
            title: `Over your candidate limit (${sub.candidate_limit})`,
            body: 'Public applications are still being accepted, but you are over your plan limit — upgrade to keep adding candidates.',
            link: '/subscription',
          })
        }
      }
    } catch (err) {
      console.error('[public-apply] plan-limit flag failed:', err)
    }
  }

  // ── 17. Send confirmation email ────────────────────────────────────────────
  try {
    const [{ data: org }, { data: templateRow }] = await Promise.all([
      supabase.from('organizations').select('name').eq('id', orgId).single(),
      supabase
        .from('email_templates')
        .select('subject, body')
        .eq('organization_id', orgId)
        .eq('template_type', 'application_received')
        .maybeSingle(),
    ])

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    await sendApplicationConfirmationEmail({
      to: email,
      candidateName: `${firstName} ${lastName}`,
      vacancyTitle: vacancy.title,
      organizationName: org?.name || 'the company',
      customSubject: templateRow?.subject,
      customBody: templateRow?.body,
      contentLocale: await fetchOrgContentLocale(supabase, orgId),
      statusUrl: `${baseUrl}/status/${newApp.public_token}`,
    })
  } catch {
    // Email failure is non-fatal
  }

  // Fire-and-forget webhook notification (Slack/Teams)
  await dispatchWebhookNotification(
    orgId,
    'application_received',
    applicationReceivedCtx({
      applicationId: newApp.id as string,
      candidateId,
      candidateName: `${firstName} ${lastName}`.trim(),
      vacancyTitle: vacancy.title,
      source: 'Public apply form',
    })
  )

  return { success: true, statusToken: newApp.public_token as string }
}
