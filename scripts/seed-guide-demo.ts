/**
 * Seed the three guide demo companies (EN / KA / RU) on STAGING.
 *
 *   npm run guide:seed                 # all three languages
 *   npm run guide:seed -- --locale ka  # one language
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local and
 * refuses any project other than staging.
 *
 * Every run RESETS the demo organizations' data (vacancies, candidates,
 * applications, interviews, offers, notes, …) and recreates it from
 * scripts/guide-demo-data.ts, so screenshots always start from the same state.
 * Only the three demo organizations are touched — found through their owner's
 * guide.<locale>.owner@example.com login.
 *
 * The organization itself is created by the real sign-up code (`runOnboarding`),
 * so it gets the same defaults a customer gets; the rest mirrors the server
 * actions (vacancy → `seed_default_pipeline_stages`, application → the vacancy's
 * stage row, stage changes → `activity_log` status_changed rows that Reports read).
 */
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { runOnboarding } from '@/lib/onboarding'
import { resolvePipelineStageId } from '@/lib/pipeline-stages/resolve'
import { normalizeScreeningQuestionEntries } from '@/lib/screening-questions/normalize'
import { computeIsKnockoutFlag } from '@/lib/screening-questions/compute-flag'
import type { ScreeningAnswerType } from '@/lib/screening-questions/knockout-condition'
import { DEFAULT_REJECTION_BODY, DEFAULT_REJECTION_SUBJECT } from '@/lib/email-template-utils'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/locales'
import { DEMO, DEMO_PASSWORD, fullName, type DemoCandidate, type DemoOrg, type DemoVacancy } from './guide-demo-data'
import { GUIDE_CALENDLY, GUIDE_CALENDLY_TOKEN, guideCalendlyEventTypeUri, guideCalendlyUserUri } from './guide-mocks/calendly-demo.mjs'

const STAGING_PROJECT_ID = 'quotchdymcnjlnwtjmgu'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).')
  process.exit(1)
}
if (!SUPABASE_URL.includes(STAGING_PROJECT_ID)) {
  console.error(`Refusing to run: the Supabase URL must be staging (${STAGING_PROJECT_ID}).`)
  process.exit(1)
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DOCS_BUCKET = 'candidate-documents'
// Plan limits of the Organization plan (lib/types/subscription.ts).
const ORG_PLAN_LIMITS = { vacancy_limit: 1000, candidate_limit: 20000, member_limit: 50 }
const OPEN_STAGES = new Set(['applied', 'screening', 'interview', 'offer'])

/** A moment `days` ago at a Tbilisi (UTC+4) hour, as ISO. */
function daysAgoAt(days: number, hour = 11, minute = 0): string {
  const d = new Date(Date.now() - days * 86_400_000)
  d.setUTCHours(hour - 4, minute, 0, 0)
  return d.toISOString()
}
const ymdInDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
const token = () => randomUUID().replace(/-/g, '')

async function must<T>(label: string, p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function lookupIds(table: string): Promise<Map<string, string>> {
  const rows = await must(`${table} lookup`, admin.from(table).select('id, code'))
  return new Map((rows as { id: string; code: string }[]).map((r) => [r.code, r.id]))
}

async function findUserByEmail(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email === email)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

async function ensureUser(email: string, name: string, metadata: Record<string, string>) {
  const existing = await findUserByEmail(email)
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, full_name: name, ...metadata },
    })
    if (error || !data.user) throw error ?? new Error(`update user failed: ${email}`)
    return data.user
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name, ...metadata },
  })
  if (error || !data.user) throw error ?? new Error(`create user failed: ${email}`)
  return data.user
}

/** A one-page PDF (Helvetica, ASCII text) — enough for a CV attachment. */
function minimalPdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`)
  const text = lines.map((l, i) => `${i === 0 ? '' : '0 -18 Td '}(${esc(l)}) Tj`).join(' ')
  const stream = `BT /F1 12 Tf 56 780 Td ${text} ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

/** Latin "First_Last" from a demo email (works for every language). */
const latinName = (email: string) =>
  email.split('@')[0]!.split('.').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('_')

// ── Reset ────────────────────────────────────────────────────────────────────

/** Delete the demo organization's business data (children first). */
async function resetOrgData(orgId: string): Promise<void> {
  const docs = await must('documents', admin.from('candidate_documents').select('file_path').eq('organization_id', orgId))
  const paths = (docs as { file_path: string }[]).map((d) => d.file_path)
  if (paths.length) await admin.storage.from(DOCS_BUCKET).remove(paths)

  const tables = [
    'candidate_evaluation_answers',
    'candidate_evaluations',
    'application_screening_answers',
    'ai_fit_analyses',
    'ai_fit_bias_reviews',
    'offers',
    'interviews',
    'candidate_notes',
    'candidate_documents',
    'candidate_experience',
    'candidate_education',
    'custom_field_values',
    'candidate_merges',
    'applications',
    'candidates',
    'candidate_import_drafts',
    'candidate_imports',
    'vacancy_questions',
    'vacancy_screening_questions',
    'pipeline_stages',
    'vacancies',
    'notifications',
    'activity_log',
    'team_invitations',
    'rejection_templates',
    'rejection_reasons',
    'custom_fields',
    'custom_field_groups',
    'webhook_notifications',
    'organization_integrations',
    'email_templates',
  ]
  for (const table of tables) {
    await must(`reset ${table}`, admin.from(table).delete().eq('organization_id', orgId))
  }
}

// ── Seed one language ────────────────────────────────────────────────────────

async function seedOrg(demo: DemoOrg): Promise<void> {
  const { locale } = demo
  console.log(`\n=== ${locale.toUpperCase()} — ${demo.companyName} ===`)

  // Users + organization (the organization through the real sign-up code).
  const userIds = new Map<string, string>()
  for (const u of demo.users) {
    const user = await ensureUser(u.email, u.fullName, {
      locale,
      ...(u.role === 'owner' ? { company_name: demo.companyName } : {}),
    })
    userIds.set(u.key, user.id)
    if (u.role === 'owner') {
      const result = await runOnboarding(user, { fullName: u.fullName, companyName: demo.companyName, locale })
      if (!result.success) throw new Error(`onboarding failed: ${result.error}`)
    }
  }
  const ownerId = userIds.get('owner')!
  const uid = (key: string) => userIds.get(key)!
  const userName = (key: string) => demo.users.find((u) => u.key === key)!.fullName
  const ownerProfile = await must('owner profile', admin.from('profiles').select('organization_id').eq('id', ownerId).single())
  const orgId = (ownerProfile as { organization_id: string }).organization_id
  if (!orgId) throw new Error('owner has no organization')

  await resetOrgData(orgId)
  console.log('  reset')

  await must('organization', admin
    .from('organizations')
    .update({
      name: demo.companyName,
      logo_url: null,
      billing_country: 'GE',
      default_content_locale: locale,
      enabled_content_locales: [locale],
      require_mfa: false,
      require_mfa_for_admins: false,
      ai_fit_enabled: false,
      ai_fit_eu_acknowledged: false,
    })
    .eq('id', orgId))

  for (const u of demo.users) {
    await must(`profile ${u.email}`, admin.from('profiles').upsert({
      id: uid(u.key),
      organization_id: orgId,
      full_name: u.fullName,
      email: u.email,
      role: u.role,
      is_active: true,
      language: locale,
    }))
  }

  // Complimentary Organization plan: no period end, so the org never locks
  // (lib/billing/access.ts) and no trial banner shows in the screenshots.
  await must('subscription', admin
    .from('subscriptions')
    .update({
      plan_code: 'organization',
      billing_cycle: 'monthly',
      status: 'active',
      trial_start_at: null,
      trial_end_at: null,
      current_period_start_at: daysAgoAt(30),
      current_period_end_at: null,
      next_billing_at: null,
      last_payment_status: null,
      ...ORG_PLAN_LIMITS,
    })
    .eq('organization_id', orgId))

  // Custom fields (vacancy + candidate groups).
  const fieldIds = new Map<string, string>()
  for (const [entity, def] of [['vacancy', demo.vacancyFields], ['candidate', demo.candidateFields]] as const) {
    const group = await must(`field group ${def.group}`, admin
      .from('custom_field_groups')
      .insert({ organization_id: orgId, entity_type: entity, name: def.group, sort_order: 1 })
      .select('id')
      .single()) as { id: string }
    for (const [i, f] of def.fields.entries()) {
      const field = await must(`field ${f.name}`, admin
        .from('custom_fields')
        .insert({ organization_id: orgId, group_id: group.id, name: f.name, field_type: f.type, is_required: false, options: f.options ?? null, sort_order: i + 1 })
        .select('id')
        .single()) as { id: string }
      fieldIds.set(`${entity}:${i}`, field.id)
    }
  }

  // Rejection reasons + templates ("General" stays the untouched default, as on sign-up).
  const reasonIds: string[] = []
  const reasons = [{ name: 'General', subject: DEFAULT_REJECTION_SUBJECT, body: DEFAULT_REJECTION_BODY }, ...demo.rejectionReasons]
  for (const [i, r] of reasons.entries()) {
    const reason = await must(`reason ${r.name}`, admin
      .from('rejection_reasons')
      .insert({ organization_id: orgId, name: r.name, sort_order: i })
      .select('id')
      .single()) as { id: string }
    reasonIds.push(reason.id)
    await must(`template ${r.name}`, admin.from('rejection_templates').insert({
      organization_id: orgId, name: r.name, subject: r.subject, body: r.body, sort_order: i, reason_id: reason.id,
    }))
  }

  // Vacancies (+ the one in the trash).
  const vacancyStatus = await lookupIds('vacancy_statuses')
  const vacancyIds = new Map<string, string>()
  const insertVacancy = async (v: DemoVacancy, deletedDaysAgo?: number) => {
    const isOpen = v.status === 'open'
    const created = daysAgoAt(v.daysAgo, 10)
    const row = await must(`vacancy ${v.title}`, admin
      .from('vacancies')
      .insert({
        organization_id: orgId,
        title: v.title,
        department: v.department,
        location: v.location,
        work_mode: v.workMode,
        employment_type: v.employmentType,
        salary_min: v.salaryMin,
        salary_max: v.salaryMax,
        salary_currency: 'GEL',
        openings_count: 1,
        start_date: created.slice(0, 10),
        status_id: vacancyStatus.get(v.status) ?? null,
        hiring_manager_id: uid(v.hiringManager),
        hiring_manager_name: userName(v.hiringManager),
        description: v.description,
        responsibilities: v.responsibilities,
        requirements: v.requirements,
        description_i18n: { [locale]: v.description },
        responsibilities_i18n: { [locale]: v.responsibilities },
        requirements_i18n: { [locale]: v.requirements },
        posting_locales: [locale],
        show_on_public_page: isOpen,
        application_form_token: isOpen ? token() : null,
        created_by: ownerId,
        created_at: created,
        ...(deletedDaysAgo !== undefined ? { deleted_at: daysAgoAt(deletedDaysAgo, 16) } : {}),
      })
      .select('id')
      .single()) as { id: string }
    await must(`stages ${v.title}`, admin.rpc('seed_default_pipeline_stages', { p_vacancy_id: row.id, p_org_id: orgId, p_created_by: ownerId }))
    return row.id
  }
  for (const v of demo.vacancies) vacancyIds.set(v.key, await insertVacancy(v))
  await insertVacancy(demo.trash.vacancy, 5)
  const engineerId = vacancyIds.get('engineer')!

  // The engineer vacancy's scorecard, screening questions and custom-field values.
  const questionIds: string[] = []
  for (const [i, q] of demo.engineerScorecard.entries()) {
    const row = await must(`scorecard ${q.label}`, admin
      .from('vacancy_questions')
      .insert({ organization_id: orgId, vacancy_id: engineerId, type: 'score', label: q.label, must_have: q.mustHave, sort_order: i })
      .select('id')
      .single()) as { id: string }
    questionIds.push(row.id)
  }
  const guideRows = (await must('interview guide', admin.from('vacancy_questions').insert(
    demo.engineerGuide.map((label, i) => ({ organization_id: orgId, vacancy_id: engineerId, type: 'text', label, must_have: false, sort_order: 100 + i })),
  ).select('id, sort_order'))) as { id: string; sort_order: number }[]
  const guideQuestionIds = guideRows.sort((a, b) => a.sort_order - b.sort_order).map((r) => r.id)
  const screening = normalizeScreeningQuestionEntries(
    demo.engineerScreening.map((q) => ({
      label: q.label,
      answerType: q.answerType,
      knockout: !!q.knockout,
      knockoutCondition: !q.knockout
        ? null
        : 'yes' in q.knockout
          ? { kind: 'yes_no' as const, passingAnswer: 'yes' as const }
          : { kind: 'number' as const, op: 'gte' as const, value: q.knockout.atLeast, value2: null },
    })),
  )
  await must('screening', admin.from('vacancy_screening_questions').insert(
    screening.map((e, i) => ({
      organization_id: orgId, vacancy_id: engineerId, label: e.label, answer_type: e.answer_type,
      is_knockout: e.is_knockout, knockout_answer: e.knockout_answer, options: e.options, sort_order: i,
    })),
  ))
  await must('vacancy field values', admin.from('custom_field_values').insert([
    { organization_id: orgId, field_id: fieldIds.get('vacancy:0')!, entity_id: engineerId, value_option: demo.vacancyFields.fields[0]!.options![0]! },
    { organization_id: orgId, field_id: fieldIds.get('vacancy:1')!, entity_id: engineerId, value_boolean: true },
  ]))
  console.log(`  vacancies: ${demo.vacancies.length} (+1 in trash)`)

  // Candidates (+ the one in the trash).
  const candidateStatus = await lookupIds('candidate_statuses')
  const candidateIds = new Map<string, string>()
  const insertCandidate = async (c: DemoCandidate, deletedDaysAgo?: number) => {
    const apps = demo.applications.filter((a) => a.candidate === c.key)
    const stages = apps.map((a) => a.journey.at(-1)!.stage)
    const status = stages.includes('hired') ? 'hired' : stages.some((s) => OPEN_STAGES.has(s)) ? 'active' : 'inactive'
    const firstApplied = Math.max(0, ...apps.map((a) => a.journey[0]!.daysAgo))
    const row = await must(`candidate ${c.email}`, admin
      .from('candidates')
      .insert({
        organization_id: orgId,
        first_name: c.firstName,
        last_name: c.lastName,
        email: c.email,
        phone: c.phone,
        current_position: c.position,
        current_company: c.company,
        years_of_experience: c.years,
        location: c.location,
        source: c.source,
        languages: c.languages ?? [],
        salary_expectation: c.salaryExpectation ?? null,
        notice_period: c.noticePeriod ?? null,
        linkedin_profile_url: c.languages ? `https://www.linkedin.com/in/${latinName(c.email).toLowerCase().replace('_', '-')}-demo` : null,
        general_status_id: candidateStatus.get(status) ?? null,
        created_by: ownerId,
        created_at: daysAgoAt(firstApplied || 6, 9, 30),
        ...(deletedDaysAgo !== undefined ? { deleted_at: daysAgoAt(deletedDaysAgo, 15) } : {}),
      })
      .select('id')
      .single()) as { id: string }
    return row.id
  }
  for (const c of demo.candidates) candidateIds.set(c.key, await insertCandidate(c))
  await insertCandidate(demo.trash.candidate, 2)
  // The showcase candidate also applied once before under a personal email —
  // the duplicate the "Merge candidates" walkthrough finds.
  const { languages: _languages, salaryExpectation: _salary, noticePeriod: _notice, ...showcase } = demo.candidates[0]!
  await insertCandidate({
    ...showcase,
    key: 'dup',
    email: showcase.email.replace('@', '.personal@'),
    source: demo.candidates[2]!.source,
  })
  const cid = (key: string) => candidateIds.get(key)!
  const cname = (key: string) => fullName(demo.candidates.find((c) => c.key === key)!)
  const vtitle = (key: string) => demo.vacancies.find((v) => v.key === key)!.title
  console.log(`  candidates: ${demo.candidates.length} (+1 in trash)`)

  // Applications, with their stage history in the audit log (Reports read it).
  const applicationIds = new Map<string, string>()
  const history: Record<string, unknown>[] = []
  for (const [i, a] of demo.applications.entries()) {
    const vacancyId = vacancyIds.get(a.vacancy)!
    const current = a.journey.at(-1)!
    const stageId = await resolvePipelineStageId(admin, vacancyId, current.stage)
    if (!stageId) throw new Error(`no "${current.stage}" stage on ${a.vacancy}`)
    const row = await must(`application ${a.candidate}`, admin
      .from('applications')
      .insert({
        organization_id: orgId,
        candidate_id: cid(a.candidate),
        vacancy_id: vacancyId,
        pipeline_stage_id: stageId,
        applied_at: daysAgoAt(a.journey[0]!.daysAgo, 9 + (i % 8), 15),
        // null until the first move, like the app — that's what makes an applicant "New"
        last_status_changed_at: a.journey.length > 1 ? daysAgoAt(current.daysAgo, 12) : null,
        created_at: daysAgoAt(a.journey[0]!.daysAgo, 9 + (i % 8), 15),
        public_token: token(),
        source_type: a.sourceType,
        created_by: ownerId,
        ...(current.stage === 'rejected' ? { rejection_reason_id: reasonIds[1 + (i % 3)] } : {}),
      })
      .select('id')
      .single()) as { id: string }
    applicationIds.set(`${a.candidate}:${a.vacancy}`, row.id)
    for (let s = 1; s < a.journey.length; s++) {
      const before = a.journey[s - 1]!.stage
      const after = a.journey[s]!.stage
      history.push({
        organization_id: orgId,
        user_id: uid(s % 2 ? 'admin' : 'owner'),
        entity_type: 'application',
        entity_id: row.id,
        action: 'status_changed',
        message: `${before} → ${after}`,
        details: { candidate_id: cid(a.candidate), before, after },
        created_at: daysAgoAt(a.journey[s]!.daysAgo, 12, 10 * s),
      })
    }
  }
  await must('stage history', admin.from('activity_log').insert(history))
  const appId = (candidate: string, vacancy: string) => applicationIds.get(`${candidate}:${vacancy}`)!
  console.log(`  applications: ${demo.applications.length} (${history.length} stage changes)`)

  // Public applicants' screening answers (flagged like the apply form does).
  const screeningRows = (await must('screening questions', admin
    .from('vacancy_screening_questions')
    .select('id, is_knockout, knockout_answer, answer_type')
    .eq('vacancy_id', engineerId)
    .order('sort_order'))) as { id: string; is_knockout: boolean; knockout_answer: string | null; answer_type: ScreeningAnswerType }[]
  await must('screening answers', admin.from('application_screening_answers').insert(
    demo.screeningAnswers.flatMap(({ candidate, answers }) =>
      answers.map((value, i) => ({
        organization_id: orgId,
        application_id: appId(candidate, 'engineer'),
        question_id: screeningRows[i]!.id,
        answer_value: value,
        is_knockout_flag: computeIsKnockoutFlag(screeningRows[i]!, value),
      })),
    ),
  ))

  // The showcase candidate's background, CV and referral field.
  await must('experience', admin.from('candidate_experience').insert(demo.experience.map((e) => ({
    organization_id: orgId, candidate_id: cid(e.candidate), company: e.company, title: e.title,
    start_date: e.from, end_date: e.to, is_current: e.to === null, description: e.description,
  }))))
  await must('education', admin.from('candidate_education').insert(demo.education.map((e) => ({
    organization_id: orgId, candidate_id: cid(e.candidate), institution: e.institution, degree: e.degree,
    field_of_study: e.field, start_year: e.from, end_year: e.to, is_ongoing: false,
  }))))
  // CVs: the showcase candidate's (added by the owner) and two that public
  // applicants sent with their application (shown in Review mode).
  const appliedDaysAgo = (key: string) => demo.applications.find((a) => a.candidate === key)!.journey[0]!.daysAgo
  const cvs = [
    { key: 'c1', uploadedBy: ownerId, lines: ['', 'Experience', ...demo.experience.map((e) => `${e.from.slice(0, 4)}-${e.to?.slice(0, 4) ?? 'now'}`)] },
    { key: 'c3', uploadedBy: null, lines: [] },
    { key: 'c5', uploadedBy: null, lines: [] },
  ]
  for (const { key, uploadedBy, lines } of cvs) {
    const c = demo.candidates.find((x) => x.key === key)!
    const cvPath = `${orgId}/${cid(key)}/${randomUUID()}.pdf`
    const cv = minimalPdf([latinName(c.email).replace('_', ' '), c.email, c.phone, ...lines])
    const upload = await admin.storage.from(DOCS_BUCKET).upload(cvPath, cv, { contentType: 'application/pdf', upsert: true })
    if (upload.error) throw new Error(`cv upload: ${upload.error.message}`)
    await must(`cv ${key}`, admin.from('candidate_documents').insert({
      organization_id: orgId, candidate_id: cid(key), document_type: 'cv', file_name: `CV_${latinName(c.email)}.pdf`, file_path: cvPath,
      mime_type: 'application/pdf', file_size_bytes: cv.length, file_size: cv.length, uploaded_by: uploadedBy,
      created_at: daysAgoAt(appliedDaysAgo(key), 9, 20),
    }))
  }
  await must('candidate field value', admin.from('custom_field_values').insert({
    organization_id: orgId, field_id: fieldIds.get('candidate:0')!, entity_id: cid('c2'), value_text: demo.candidateFields.referredBy,
  }))

  // Interviews.
  await must('interviews', admin.from('interviews').insert(demo.interviews.map((iv) => ({
    organization_id: orgId,
    candidate_id: cid(iv.candidate),
    vacancy_id: vacancyIds.get(iv.vacancy)!,
    application_id: appId(iv.candidate, iv.vacancy),
    interviewer_id: uid(iv.interviewer),
    scheduled_at: `${ymdInDays(iv.inDays)}T${iv.time}:00+04:00`,
    duration_minutes: iv.duration,
    type: iv.type,
    status: iv.status,
    rating: iv.rating ?? null,
    feedback: iv.feedback || null,
    meeting_link: iv.link ?? null,
    created_at: daysAgoAt(Math.max(1, -iv.inDays + 3), 10),
  }))))

  // Offers.
  await must('offers', admin.from('offers').insert(demo.offers.map((o) => ({
    organization_id: orgId,
    application_id: appId(o.candidate, o.vacancy),
    role_title: vtitle(o.vacancy),
    compensation_amount: o.amount,
    compensation_currency: 'GEL',
    compensation_period: 'monthly',
    start_date: ymdInDays(o.startInDays),
    expiry_date: ymdInDays(o.expiryInDays),
    body: o.body,
    recruiter_message: o.message ?? null,
    status: o.status,
    public_token: token(),
    sent_at: daysAgoAt(o.sentDaysAgo, 13),
    responded_at: o.respondedDaysAgo !== undefined ? daysAgoAt(o.respondedDaysAgo, 18) : null,
    created_by: ownerId,
    created_at: daysAgoAt(o.sentDaysAgo, 12),
  }))))

  // Assessments (one card per reviewer, scored against the engineer scorecard).
  for (const e of demo.evaluations) {
    // Stored like the assessment sheet does: the fit as a percentage of the maximum.
    const fitPercent = Math.round((e.scores.reduce((s, n) => s + n, 0) / (e.scores.length * 5)) * 100)
    const ev = await must('evaluation', admin
      .from('candidate_evaluations')
      .insert({
        organization_id: orgId, application_id: appId(e.candidate, e.vacancy), candidate_id: cid(e.candidate),
        vacancy_id: vacancyIds.get(e.vacancy)!, reviewer_id: uid(e.reviewer), is_active: true, score: fitPercent,
        recommendation: e.recommendation, recommendation_reason: e.reason, submitted: true,
        created_at: daysAgoAt(e.daysAgo, 16), updated_at: daysAgoAt(e.daysAgo, 16),
      })
      .select('id')
      .single()) as { id: string }
    await must('evaluation answers', admin.from('candidate_evaluation_answers').insert([
      ...e.scores.map((score, i) => ({ organization_id: orgId, evaluation_id: ev.id, question_id: questionIds[i]!, score_value: score })),
      ...(e.answers ?? []).map((text, i) => ({ organization_id: orgId, evaluation_id: ev.id, question_id: guideQuestionIds[i]!, text_value: text })),
    ]))
  }

  // Notes (one mentions the owner).
  await must('notes', admin.from('candidate_notes').insert(demo.notes.map((n) => ({
    organization_id: orgId, candidate_id: cid(n.candidate), note_text: n.text, created_by: uid(n.author),
    mentions: n.mention ? [uid(n.mention)] : [], created_at: daysAgoAt(n.daysAgo, 17),
  }))))

  // The owner's notifications (rendered from type + data, so they're translated).
  const mentionNote = demo.notes.find((n) => n.mention)!
  await must('notifications', admin.from('notifications').insert([
    { type: 'new_application', data: { name: cname('c5'), vacancy: vtitle('engineer') }, link: `/candidates/${cid('c5')}`, at: daysAgoAt(0, 9, 40), read: false },
    { type: 'note_mention', data: { author: userName(mentionNote.author), candidate: cname(mentionNote.candidate) }, body: mentionNote.text, link: `/candidates/${cid(mentionNote.candidate)}`, at: daysAgoAt(1, 17), read: false },
    { type: 'interview_scheduled', data: { name: cname('c7'), vacancy: vtitle('designer') }, link: '/interviews', at: daysAgoAt(1, 12), read: false },
    { type: 'new_application', data: { name: cname('c3'), vacancy: vtitle('engineer') }, link: `/candidates/${cid('c3')}`, at: daysAgoAt(4, 10), read: true },
    { type: 'candidate_hired', data: { name: cname('c16'), vacancy: vtitle('support') }, link: `/candidates/${cid('c16')}`, at: daysAgoAt(25, 18), read: true },
  ].map((n) => ({
    organization_id: orgId, recipient_id: ownerId, type: n.type, title: n.type, body: n.body ?? null,
    link: n.link, data: n.data, created_at: n.at, read_at: n.read ? n.at : null,
  }))))

  // A pending invitation.
  await must('invitation', admin.from('team_invitations').insert({
    organization_id: orgId, email: demo.invite.email, role: demo.invite.role, token: randomUUID(),
    invited_by: ownerId, status: 'pending', expires_at: daysAgoAt(-6), created_at: daysAgoAt(1, 14),
  }))

  // The team's Slack channel. A made-up webhook URL — the walkthroughs never trigger a post, and a
  // real-looking Slack token (T…/B…/24 chars) would trip GitHub's secret scanning on push.
  await must('slack webhook', admin.from('webhook_notifications').insert({
    organization_id: orgId, channel_type: 'slack', name: demo.slackChannel,
    webhook_url: 'https://hooks.slack.com/services/T0DEMO/B0DEMO/guide-demo-only',
    enabled_events: ['application_received', 'interview_scheduled', 'offer_accepted', 'application_hired'],
    is_active: true, created_by: ownerId,
  }))
  console.log('  interviews, offers, assessments, notes, notifications, invitation, Slack channel: done')

  // The company's LinkedIn page — a page id is all the connection stores.
  await must('linkedin page', admin.from('organization_integrations').insert({
    organization_id: orgId, platform: 'linkedin', external_page_id: demo.linkedInPageId,
    external_page_name: demo.linkedInPageId, access_token: 'manual', connected_by: ownerId, is_active: true,
  }))

  // Calendly, "connected" by the owner with a demo token that the walkthrough server's
  // Calendly stand-in answers (scripts/guide-mocks/calendly-api.mjs) — never a real account.
  const calendlyUser = guideCalendlyUserUri(locale)
  const eventType = GUIDE_CALENDLY[locale].eventTypes[0]!
  const { error: calendlyError } = await admin.from('organization_integrations').insert({
    organization_id: orgId, platform: 'calendly',
    external_page_id: calendlyUser, external_page_name: userName('owner'), external_user_uri: calendlyUser,
    access_token: `${GUIDE_CALENDLY_TOKEN}-${locale}`, token_expires_at: '2099-01-01T00:00:00Z',
    selected_event_type_uri: guideCalendlyEventTypeUri(locale, eventType.id),
    selected_event_type_name: eventType.name, connected_by: ownerId, is_active: true,
  })
  if (calendlyError) {
    // Until 20261010_organization_integrations_fixes.sql is applied, the table only allows LinkedIn.
    console.warn(`  ⚠ Calendly not seeded (${calendlyError.message}) — apply 20261010_organization_integrations_fixes.sql`)
  }
  console.log('  LinkedIn page, Calendly: done')
}

async function main(): Promise<void> {
  const flag = process.argv.indexOf('--locale')
  const only = flag > -1 ? process.argv[flag + 1] : undefined
  if (only !== undefined && !isLocale(only)) {
    console.error(`--locale must be one of ${LOCALES.join(', ')}`)
    process.exit(1)
  }
  for (const locale of only ? [only] : LOCALES) await seedOrg(DEMO[locale as Locale])
  console.log(`\nDone. Logins: guide.<en|ka|ru>.<owner|admin|member>@example.com / ${DEMO_PASSWORD}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
