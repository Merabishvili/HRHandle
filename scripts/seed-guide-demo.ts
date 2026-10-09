/**
 * Seed the three guide demo companies (EN / KA / RU) on STAGING.
 *
 *   npm run guide:seed                 # all three languages
 *   npm run guide:seed -- --locale ka  # one language
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local and
 * refuses any project other than staging. Idempotent: re-running updates rows
 * (matched by email / title) instead of duplicating them.
 *
 * The organization is created by the real sign-up code (`runOnboarding`), so it
 * gets the same defaults a customer gets; everything else mirrors the server
 * actions (vacancy → `seed_default_pipeline_stages`, application → the
 * vacancy's stage row, candidate status follows open applications).
 */
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { runOnboarding } from '@/lib/onboarding'
import { resolvePipelineStageId } from '@/lib/pipeline-stages/resolve'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/locales'
import { DEMO, DEMO_PASSWORD, type DemoOrg } from './guide-demo-data'

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

/** Second content language shown in the wizard's language tabs. */
const EXTRA_CONTENT_LOCALE: Record<Locale, Locale> = { en: 'ka', ka: 'en', ru: 'en' }

// Plan limits of the Organization plan (lib/types/subscription.ts).
const ORG_PLAN_LIMITS = { vacancy_limit: 1000, candidate_limit: 20000, member_limit: 50 }

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

async function lookupIds(table: string): Promise<Map<string, string>> {
  const { data, error } = await admin.from(table).select('id, code')
  if (error || !data) throw error ?? new Error(`${table} lookup failed`)
  return new Map(data.map((r) => [r.code as string, r.id as string]))
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

async function ensureUser(email: string, fullName: string, metadata: Record<string, string>) {
  const existing = await findUserByEmail(email)
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, full_name: fullName, ...metadata },
    })
    if (error || !data.user) throw error ?? new Error(`update user failed: ${email}`)
    return data.user
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, ...metadata },
  })
  if (error || !data.user) throw error ?? new Error(`create user failed: ${email}`)
  return data.user
}

async function seedOrg(demo: DemoOrg): Promise<void> {
  const { locale } = demo
  console.log(`\n=== ${locale.toUpperCase()} — ${demo.companyName} ===`)

  // ── Users + organization ────────────────────────────────────────────────
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
      console.log(result.alreadyInitialized ? '  organization exists' : '  organization created (sign-up defaults)')
    }
  }
  const ownerId = userIds.get('owner')!
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', ownerId)
    .single()
  const orgId = ownerProfile?.organization_id as string
  if (!orgId) throw new Error('owner has no organization')

  await admin
    .from('organizations')
    .update({
      name: demo.companyName,
      billing_country: 'GE',
      default_content_locale: locale,
      enabled_content_locales: [locale, EXTRA_CONTENT_LOCALE[locale]],
    })
    .eq('id', orgId)

  for (const u of demo.users) {
    const { error } = await admin.from('profiles').upsert({
      id: userIds.get(u.key)!,
      organization_id: orgId,
      full_name: u.fullName,
      email: u.email,
      role: u.role,
      is_active: true,
      language: locale,
    })
    if (error) throw error
  }
  console.log(`  ${demo.users.length} team members`)

  // Complimentary Organization plan: no period end, so the org never locks
  // (lib/billing/access.ts) and no trial banner shows in the screenshots.
  await admin
    .from('subscriptions')
    .update({
      plan_code: 'organization',
      billing_cycle: 'monthly',
      status: 'active',
      trial_start_at: null,
      trial_end_at: null,
      current_period_start_at: daysAgoIso(30),
      current_period_end_at: null,
      next_billing_at: null,
      last_payment_status: null,
      ...ORG_PLAN_LIMITS,
    })
    .eq('organization_id', orgId)

  // ── Vacancy custom fields ──────────────────────────────────────────────
  let { data: group } = await admin
    .from('custom_field_groups')
    .select('id')
    .eq('organization_id', orgId)
    .eq('entity_type', 'vacancy')
    .eq('name', demo.vacancyFields.group)
    .maybeSingle()
  if (!group) {
    const { data, error } = await admin
      .from('custom_field_groups')
      .insert({ organization_id: orgId, entity_type: 'vacancy', name: demo.vacancyFields.group, sort_order: 1 })
      .select('id')
      .single()
    if (error) throw error
    group = data
  }
  for (const [i, f] of demo.vacancyFields.fields.entries()) {
    const payload = { field_type: f.type, is_required: false, options: f.options ?? null, sort_order: i + 1 }
    const { data: existing } = await admin
      .from('custom_fields')
      .select('id')
      .eq('group_id', group!.id)
      .eq('name', f.name)
      .is('deleted_at', null)
      .maybeSingle()
    if (existing) await admin.from('custom_fields').update(payload).eq('id', existing.id)
    else await admin.from('custom_fields').insert({ organization_id: orgId, group_id: group!.id, name: f.name, ...payload })
  }
  console.log(`  custom fields: ${demo.vacancyFields.fields.length}`)

  // ── Vacancies ─────────────────────────────────────────────────────────
  const vacancyStatus = await lookupIds('vacancy_statuses')
  const vacancyIds = new Map<string, string>()
  for (const v of demo.vacancies) {
    const created = daysAgoIso(v.daysAgo)
    const isOpen = v.status === 'open'
    const payload = {
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
      hiring_manager_id: userIds.get(v.hiringManager),
      hiring_manager_name: demo.users.find((u) => u.key === v.hiringManager)?.fullName ?? null,
      description: v.description,
      responsibilities: v.responsibilities,
      requirements: v.requirements,
      description_i18n: { [locale]: v.description },
      responsibilities_i18n: { [locale]: v.responsibilities },
      requirements_i18n: { [locale]: v.requirements },
      posting_locales: [locale],
      show_on_public_page: isOpen,
      created_by: ownerId,
    }
    const { data: existing } = await admin
      .from('vacancies')
      .select('id, application_form_token')
      .eq('organization_id', orgId)
      .eq('title', v.title)
      .is('deleted_at', null)
      .maybeSingle()
    let id: string
    if (existing) {
      id = existing.id
      await admin
        .from('vacancies')
        .update({
          ...payload,
          ...(isOpen && !existing.application_form_token
            ? { application_form_token: randomUUID().replace(/-/g, '') }
            : {}),
        })
        .eq('id', id)
    } else {
      const { data, error } = await admin
        .from('vacancies')
        .insert({
          ...payload,
          created_at: created,
          ...(isOpen ? { application_form_token: randomUUID().replace(/-/g, '') } : {}),
        })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error(`vacancy insert failed: ${v.title}`)
      id = data.id
    }
    const { count } = await admin
      .from('pipeline_stages')
      .select('id', { count: 'exact', head: true })
      .eq('vacancy_id', id)
    if (!count) {
      const { error } = await admin.rpc('seed_default_pipeline_stages', {
        p_vacancy_id: id,
        p_org_id: orgId,
        p_created_by: ownerId,
      })
      if (error) throw new Error(`stage seed failed for ${v.title}: ${error.message}`)
    }
    vacancyIds.set(v.key, id)
  }
  console.log(`  vacancies: ${demo.vacancies.length}`)

  // ── Candidates + applications ─────────────────────────────────────────
  const candidateStatus = await lookupIds('candidate_statuses')
  const openStages = new Set(['applied', 'screening', 'interview', 'offer'])
  const candidateIds = new Map<string, string>()
  for (const c of demo.candidates) {
    const hasOpenApplication = demo.applications.some((a) => a.candidate === c.key && openStages.has(a.stage))
    const payload = {
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
      general_status_id: candidateStatus.get(hasOpenApplication ? 'active' : 'inactive') ?? null,
      created_by: ownerId,
    }
    const { data: existing } = await admin
      .from('candidates')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', c.email)
      .is('deleted_at', null)
      .maybeSingle()
    if (existing) {
      await admin.from('candidates').update(payload).eq('id', existing.id)
      candidateIds.set(c.key, existing.id)
    } else {
      const firstApplied = Math.max(0, ...demo.applications.filter((a) => a.candidate === c.key).map((a) => a.daysAgo))
      const { data, error } = await admin
        .from('candidates')
        .insert({ ...payload, created_at: daysAgoIso(firstApplied) })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error(`candidate insert failed: ${c.email}`)
      candidateIds.set(c.key, data.id)
    }
  }
  console.log(`  candidates: ${demo.candidates.length}`)

  for (const a of demo.applications) {
    const candidateId = candidateIds.get(a.candidate)!
    const vacancyId = vacancyIds.get(a.vacancy)!
    const stageId = await resolvePipelineStageId(admin, vacancyId, a.stage)
    if (!stageId) throw new Error(`no "${a.stage}" stage on vacancy ${a.vacancy}`)
    const { data: existing } = await admin
      .from('applications')
      .select('id')
      .eq('candidate_id', candidateId)
      .eq('vacancy_id', vacancyId)
      .is('deleted_at', null)
      .maybeSingle()
    if (existing) {
      await admin.from('applications').update({ pipeline_stage_id: stageId }).eq('id', existing.id)
    } else {
      const { error } = await admin.from('applications').insert({
        organization_id: orgId,
        candidate_id: candidateId,
        vacancy_id: vacancyId,
        pipeline_stage_id: stageId,
        applied_at: daysAgoIso(a.daysAgo),
        last_status_changed_at: daysAgoIso(Math.max(0, a.daysAgo - 2)),
        created_at: daysAgoIso(a.daysAgo),
        public_token: randomUUID().replace(/-/g, ''),
        source_type: a.sourceType,
        created_by: ownerId,
      })
      if (error) throw new Error(`application insert failed: ${error.message}`)
    }
  }
  console.log(`  applications: ${demo.applications.length}`)
}

async function main(): Promise<void> {
  const flag = process.argv.indexOf('--locale')
  const only = flag > -1 ? process.argv[flag + 1] : undefined
  if (only !== undefined && !isLocale(only)) {
    console.error(`--locale must be one of ${LOCALES.join(', ')}`)
    process.exit(1)
  }
  for (const locale of only ? [only] : LOCALES) await seedOrg(DEMO[locale])
  console.log(`\nDone. Logins: guide.<en|ka|ru>.<owner|admin|member>@example.com / ${DEMO_PASSWORD}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
