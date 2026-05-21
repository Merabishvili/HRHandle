/**
 * Seed a demo organization on the target Supabase project (intended for staging).
 *
 * Creates:
 *   - Two auth users (owner + admin) with deterministic emails and passwords.
 *   - An organization "Acme Corporation" with a public slug.
 *   - Profiles linked to the org, both active.
 *   - A subscription in "active" state with realistic limits.
 *   - Three vacancies (Senior Software Engineer, Product Designer, Marketing Manager)
 *     plus one draft (HR Coordinator), each with a public application_form_token.
 *
 * Idempotent: re-running updates existing rows by ID instead of duplicating.
 *
 * Usage (against staging):
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://<staging-project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   npm run guide:seed
 *
 * Login emails / passwords are printed at the end. Add them to your local
 * .env.local as STAGING_DEMO_EMAIL / STAGING_DEMO_PASSWORD before running
 * the screenshot script.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

// Hard guard: refuse to run against production.
const STAGING_PROJECT_ID = 'quotchdymcnjlnwtjmgu'
if (!SUPABASE_URL.includes(STAGING_PROJECT_ID)) {
  console.error(
    `Refusing to run: SUPABASE_URL must be staging (project id ${STAGING_PROJECT_ID}).\n` +
      `Got: ${SUPABASE_URL}`
  )
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const OWNER_EMAIL = 'demo.owner@hrhandle-demo.com'
const ADMIN_EMAIL = 'demo.admin@hrhandle-demo.com'
const DEMO_PASSWORD = 'DemoUser!2026'
const ORG_NAME = 'Acme Corporation'
const ORG_SLUG = 'acme-corporation-demo'
const PUBLIC_SLUG = 'acme-corporation'

async function ensureUser(email: string, fullName: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const existing = list?.users.find((u) => u.email === email)
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    console.log(`  user exists: ${email}`)
    return existing.id
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !data.user) throw error ?? new Error('create user failed')
  console.log(`  user created: ${email}`)
  return data.user.id
}

async function ensureOrganization(): Promise<string> {
  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', ORG_SLUG)
    .maybeSingle()
  if (existing) {
    console.log(`  org exists: ${ORG_NAME}`)
    return existing.id
  }
  const { data, error } = await admin
    .from('organizations')
    .insert({
      name: ORG_NAME,
      slug: ORG_SLUG,
      public_page_slug: PUBLIC_SLUG,
      is_active: true,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('create org failed')
  console.log(`  org created: ${ORG_NAME}`)
  return data.id
}

async function ensureProfile(
  userId: string,
  orgId: string,
  fullName: string,
  email: string,
  role: 'owner' | 'admin'
): Promise<void> {
  const { error } = await admin.from('profiles').upsert({
    id: userId,
    organization_id: orgId,
    full_name: fullName,
    email,
    role,
    is_active: true,
  })
  if (error) throw error
}

async function ensureSubscription(orgId: string): Promise<void> {
  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('organization_id', orgId)
    .maybeSingle()

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + 30)

  const payload = {
    organization_id: orgId,
    plan_code: 'organization' as const,
    billing_cycle: 'monthly' as const,
    status: 'active' as const,
    trial_start_at: null,
    trial_end_at: null,
    current_period_start_at: now.toISOString(),
    current_period_end_at: periodEnd.toISOString(),
    next_billing_at: periodEnd.toISOString(),
    payment_method_linked: true,
    vacancy_limit: 50,
    candidate_limit: 1000,
    member_limit: 10,
  }

  if (existing) {
    await admin.from('subscriptions').update(payload).eq('id', existing.id)
    console.log('  subscription updated')
  } else {
    await admin.from('subscriptions').insert(payload)
    console.log('  subscription created')
  }
}

interface VacancySeed {
  title: string
  description: string
  responsibilities: string
  requirements: string
  location: string
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship'
  status_code: 'draft' | 'open'
  salary_min: number | null
  salary_max: number | null
}

const VACANCIES: VacancySeed[] = [
  {
    title: 'Senior Software Engineer',
    description:
      'Join Acme to build customer-facing platform features in TypeScript and React. You will own end-to-end delivery, partner with product and design, and help mentor mid-level engineers on the team.',
    responsibilities:
      'Design, build, and ship features across the stack. Review code, write tests, contribute to architectural decisions, and help keep the codebase healthy.',
    requirements:
      'Five or more years of professional software engineering experience, strong TypeScript and React skills, and a track record of shipping production systems.',
    location: 'Berlin, Germany',
    employment_type: 'full_time',
    status_code: 'open',
    salary_min: 80000,
    salary_max: 110000,
  },
  {
    title: 'Product Designer',
    description:
      'Own the end-to-end design of new product surfaces, from research through final delivery. Work closely with engineering and product to validate ideas quickly.',
    responsibilities:
      'Conduct user research, produce flows and prototypes, partner with engineering on implementation, and contribute to the design system.',
    requirements:
      'Three or more years of product design experience, fluency with Figma, and a portfolio demonstrating shipped SaaS work.',
    location: 'Remote',
    employment_type: 'full_time',
    status_code: 'open',
    salary_min: 70000,
    salary_max: 95000,
  },
  {
    title: 'Marketing Manager',
    description:
      'Lead Acme’s growth marketing across paid, content, and lifecycle channels. Define the playbook, then build the team to execute it.',
    responsibilities:
      'Plan and run campaigns, manage the marketing budget, work with sales on pipeline goals, and report on attribution and ROI.',
    requirements:
      'Five or more years in B2B SaaS marketing, comfort with analytics tools, and a strong portfolio of measurable campaign outcomes.',
    location: 'London, United Kingdom',
    employment_type: 'full_time',
    status_code: 'open',
    salary_min: 65000,
    salary_max: 85000,
  },
  {
    title: 'HR Coordinator',
    description:
      'Support the people team with day-to-day operations across onboarding, employee experience, and compliance.',
    responsibilities:
      'Manage new-hire onboarding, maintain employee records, coordinate benefits and time-off, and assist with policy rollouts.',
    requirements: 'One or more years of HR or people-ops experience, strong organisational skills, and excellent written communication.',
    location: 'Berlin, Germany',
    employment_type: 'part_time',
    status_code: 'draft',
    salary_min: null,
    salary_max: null,
  },
]

async function ensureVacancies(orgId: string, creatorId: string): Promise<void> {
  const { data: statuses, error: statusErr } = await admin
    .from('vacancy_statuses')
    .select('id, code')
  if (statusErr || !statuses) throw statusErr ?? new Error('vacancy_statuses query failed')
  const statusByCode = new Map(statuses.map((s) => [s.code, s.id]))

  const today = new Date()
  const startIso = today.toISOString().slice(0, 10)

  for (const v of VACANCIES) {
    const { data: existing } = await admin
      .from('vacancies')
      .select('id')
      .eq('organization_id', orgId)
      .eq('title', v.title)
      .is('deleted_at', null)
      .maybeSingle()

    const payload = {
      organization_id: orgId,
      title: v.title,
      description: v.description,
      responsibilities: v.responsibilities,
      requirements: v.requirements,
      location: v.location,
      employment_type: v.employment_type,
      salary_min: v.salary_min,
      salary_max: v.salary_max,
      salary_currency: 'USD',
      openings_count: 1,
      start_date: startIso,
      status_id: statusByCode.get(v.status_code) ?? null,
      created_by: creatorId,
      application_form_token: v.status_code === 'open' ? randomUUID().replace(/-/g, '') : null,
      show_on_public_page: v.status_code === 'open',
    }

    if (existing) {
      await admin.from('vacancies').update(payload).eq('id', existing.id)
      console.log(`  vacancy updated: ${v.title}`)
    } else {
      await admin.from('vacancies').insert(payload)
      console.log(`  vacancy created: ${v.title}`)
    }
  }
}

interface CandidateSeed {
  first_name: string
  last_name: string
  email: string
  phone: string
  linkedin_profile_url: string | null
  current_position: string
  current_company: string
  location: string
  source: string
  status_code: 'active' | 'hired' | 'archived'
}

const CANDIDATES: CandidateSeed[] = [
  {
    first_name: 'Lukas',
    last_name: 'Becker',
    email: 'lukas.becker@example.com',
    phone: '+49 30 1234 5678',
    linkedin_profile_url: 'https://www.linkedin.com/in/lukas-becker-demo/',
    current_position: 'Senior Backend Engineer',
    current_company: 'Stripe',
    location: 'Berlin, Germany',
    source: 'LinkedIn',
    status_code: 'active',
  },
  {
    first_name: 'Sofia',
    last_name: 'Rossi',
    email: 'sofia.rossi@example.com',
    phone: '+39 02 1234 5678',
    linkedin_profile_url: 'https://www.linkedin.com/in/sofia-rossi-demo/',
    current_position: 'Product Designer',
    current_company: 'Figma',
    location: 'Milan, Italy',
    source: 'Referral',
    status_code: 'active',
  },
  {
    first_name: 'Marco',
    last_name: 'Silva',
    email: 'marco.silva@example.com',
    phone: '+44 20 1234 5678',
    linkedin_profile_url: 'https://www.linkedin.com/in/marco-silva-demo/',
    current_position: 'Marketing Manager',
    current_company: 'HubSpot',
    location: 'London, United Kingdom',
    source: 'Apply form',
    status_code: 'active',
  },
  {
    first_name: 'Anna',
    last_name: 'Petrov',
    email: 'anna.petrov@example.com',
    phone: '+1 415 555 0123',
    linkedin_profile_url: 'https://www.linkedin.com/in/anna-petrov-demo/',
    current_position: 'Full Stack Developer',
    current_company: 'Vercel',
    location: 'Remote',
    source: 'LinkedIn',
    status_code: 'active',
  },
]

async function ensureCandidates(orgId: string, creatorId: string): Promise<void> {
  const { data: statuses, error: statusErr } = await admin
    .from('candidate_statuses')
    .select('id, code')
  if (statusErr || !statuses) throw statusErr ?? new Error('candidate_statuses query failed')
  const statusByCode = new Map(statuses.map((s) => [s.code, s.id]))

  for (const c of CANDIDATES) {
    const { data: existing } = await admin
      .from('candidates')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', c.email)
      .is('deleted_at', null)
      .maybeSingle()

    const payload = {
      organization_id: orgId,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      linkedin_profile_url: c.linkedin_profile_url,
      current_position: c.current_position,
      current_company: c.current_company,
      location: c.location,
      source: c.source,
      general_status_id: statusByCode.get(c.status_code) ?? null,
      created_by: creatorId,
    }

    if (existing) {
      await admin.from('candidates').update(payload).eq('id', existing.id)
      console.log(`  candidate updated: ${c.first_name} ${c.last_name}`)
    } else {
      await admin.from('candidates').insert(payload)
      console.log(`  candidate created: ${c.first_name} ${c.last_name}`)
    }
  }
}

/**
 * Distribute the seeded candidates across the Senior Software Engineer
 * vacancy's pipeline stages, so the Kanban board has visual richness for
 * screenshots. Idempotent: no-ops if an application already links the
 * candidate and vacancy.
 */
async function ensureApplications(orgId: string, creatorId: string): Promise<void> {
  // Find the target vacancy (SR Engineer is the showcase one).
  const { data: vacancy } = await admin
    .from('vacancies')
    .select('id')
    .eq('organization_id', orgId)
    .eq('title', 'Senior Software Engineer')
    .is('deleted_at', null)
    .maybeSingle()
  if (!vacancy) {
    console.log('  vacancy not found, skipping applications')
    return
  }

  const { data: statuses } = await admin
    .from('application_statuses')
    .select('id, code')
  const byCode = new Map((statuses ?? []).map((s) => [s.code, s.id as string]))

  // Each candidate goes to a specific pipeline stage on the SR Engineer vacancy.
  const placements: Array<{ email: string; code: string }> = [
    { email: 'lukas.becker@example.com', code: 'interview' },
    { email: 'sofia.rossi@example.com', code: 'screening' },
    { email: 'marco.silva@example.com', code: 'applied' },
    { email: 'anna.petrov@example.com', code: 'offer' },
  ]

  for (const p of placements) {
    const statusId = byCode.get(p.code)
    if (!statusId) {
      console.log(`  status not found: ${p.code}`)
      continue
    }

    const { data: candidate } = await admin
      .from('candidates')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', p.email)
      .is('deleted_at', null)
      .maybeSingle()
    if (!candidate) {
      console.log(`  candidate not found: ${p.email}`)
      continue
    }

    const { data: existing } = await admin
      .from('applications')
      .select('id')
      .eq('organization_id', orgId)
      .eq('candidate_id', candidate.id)
      .eq('vacancy_id', vacancy.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (existing) {
      await admin
        .from('applications')
        .update({ status_id: statusId, last_status_changed_at: new Date().toISOString() })
        .eq('id', existing.id)
      console.log(`  application updated: ${p.email} → ${p.code}`)
    } else {
      await admin.from('applications').insert({
        organization_id: orgId,
        candidate_id: candidate.id,
        vacancy_id: vacancy.id,
        status_id: statusId,
        applied_at: new Date().toISOString(),
        last_status_changed_at: new Date().toISOString(),
        created_by: creatorId,
      })
      console.log(`  application created: ${p.email} → ${p.code}`)
    }
  }
}

interface QuestionSeed {
  label: string
  type: 'text' | 'score'
  sort_order: number
}

const SR_ENGINEER_QUESTIONS: QuestionSeed[] = [
  { label: 'Tell us about a recent system you designed end-to-end.', type: 'text', sort_order: 10 },
  { label: 'How do you approach code reviews on a busy team?', type: 'text', sort_order: 20 },
  { label: 'TypeScript depth', type: 'score', sort_order: 100 },
  { label: 'System design clarity', type: 'score', sort_order: 110 },
  { label: 'Communication and collaboration', type: 'score', sort_order: 120 },
]

async function ensureVacancyQuestions(orgId: string): Promise<void> {
  void orgId // referenced in the insert payload below

  const { data: vacancy } = await admin
    .from('vacancies')
    .select('id')
    .eq('organization_id', orgId)
    .eq('title', 'Senior Software Engineer')
    .is('deleted_at', null)
    .maybeSingle()
  if (!vacancy) {
    console.log('  vacancy not found, skipping questions')
    return
  }

  for (const q of SR_ENGINEER_QUESTIONS) {
    const { data: existing } = await admin
      .from('vacancy_questions')
      .select('id')
      .eq('vacancy_id', vacancy.id)
      .eq('label', q.label)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from('vacancy_questions')
        .update({ type: q.type, sort_order: q.sort_order })
        .eq('id', existing.id)
      if (error) console.log(`  question update failed: ${q.label} — ${error.message}`)
      else console.log(`  question updated: ${q.label}`)
    } else {
      const { error } = await admin.from('vacancy_questions').insert({
        organization_id: orgId,
        vacancy_id: vacancy.id,
        label: q.label,
        type: q.type,
        sort_order: q.sort_order,
      })
      if (error) console.log(`  question insert failed: ${q.label} — ${error.message}`)
      else console.log(`  question created: ${q.label}`)
    }
  }
}

type FieldType = 'text' | 'long_text' | 'date' | 'number' | 'dropdown' | 'checkbox'

interface FieldSeed {
  name: string
  field_type: FieldType
  is_required: boolean
  options?: string[]
  sort_order: number
}

interface GroupSeed {
  entity_type: 'vacancy' | 'candidate'
  name: string
  sort_order: number
  fields: FieldSeed[]
}

const CUSTOM_FIELD_GROUPS: GroupSeed[] = [
  {
    entity_type: 'vacancy',
    name: 'Tech requirements',
    sort_order: 1,
    fields: [
      { name: 'Tech stack', field_type: 'text', is_required: false, sort_order: 1 },
      { name: 'Years experience minimum', field_type: 'number', is_required: false, sort_order: 2 },
      { name: 'Remote allowed', field_type: 'checkbox', is_required: false, sort_order: 3 },
      {
        name: 'Seniority level',
        field_type: 'dropdown',
        is_required: false,
        options: ['Junior', 'Mid', 'Senior', 'Staff'],
        sort_order: 4,
      },
    ],
  },
  {
    entity_type: 'candidate',
    name: 'Background',
    sort_order: 1,
    fields: [
      { name: 'Preferred languages', field_type: 'text', is_required: false, sort_order: 1 },
      { name: 'Notice period (weeks)', field_type: 'number', is_required: false, sort_order: 2 },
      { name: 'Background check completed', field_type: 'checkbox', is_required: false, sort_order: 3 },
    ],
  },
]

async function ensureCustomFields(orgId: string): Promise<Map<string, string>> {
  // Returns a map of "<entity_type>:<field_name>" → field_id, so caller can
  // upsert values without re-querying.
  const fieldIdByKey = new Map<string, string>()

  for (const group of CUSTOM_FIELD_GROUPS) {
    let groupId: string
    const { data: existingGroup } = await admin
      .from('custom_field_groups')
      .select('id')
      .eq('organization_id', orgId)
      .eq('entity_type', group.entity_type)
      .eq('name', group.name)
      .maybeSingle()

    if (existingGroup) {
      groupId = existingGroup.id
      console.log(`  group exists: [${group.entity_type}] ${group.name}`)
    } else {
      const { data, error } = await admin
        .from('custom_field_groups')
        .insert({
          organization_id: orgId,
          entity_type: group.entity_type,
          name: group.name,
          sort_order: group.sort_order,
        })
        .select('id')
        .single()
      if (error || !data) {
        console.log(`  group insert failed: ${group.name} — ${error?.message}`)
        continue
      }
      groupId = data.id
      console.log(`  group created: [${group.entity_type}] ${group.name}`)
    }

    for (const f of group.fields) {
      const { data: existingField } = await admin
        .from('custom_fields')
        .select('id')
        .eq('group_id', groupId)
        .eq('name', f.name)
        .is('deleted_at', null)
        .maybeSingle()

      if (existingField) {
        await admin
          .from('custom_fields')
          .update({
            field_type: f.field_type,
            is_required: f.is_required,
            options: f.options ?? null,
            sort_order: f.sort_order,
          })
          .eq('id', existingField.id)
        fieldIdByKey.set(`${group.entity_type}:${f.name}`, existingField.id)
        console.log(`    field updated: ${f.name}`)
      } else {
        const { data, error } = await admin
          .from('custom_fields')
          .insert({
            organization_id: orgId,
            group_id: groupId,
            name: f.name,
            field_type: f.field_type,
            is_required: f.is_required,
            options: f.options ?? null,
            sort_order: f.sort_order,
          })
          .select('id')
          .single()
        if (error || !data) {
          console.log(`    field insert failed: ${f.name} — ${error?.message}`)
          continue
        }
        fieldIdByKey.set(`${group.entity_type}:${f.name}`, data.id)
        console.log(`    field created: ${f.name}`)
      }
    }
  }

  return fieldIdByKey
}

async function setSrEngineerCustomValues(
  orgId: string,
  fieldIdByKey: Map<string, string>
): Promise<void> {
  const { data: vacancy } = await admin
    .from('vacancies')
    .select('id')
    .eq('organization_id', orgId)
    .eq('title', 'Senior Software Engineer')
    .is('deleted_at', null)
    .maybeSingle()
  if (!vacancy) return

  const values = [
    {
      field_id: fieldIdByKey.get('vacancy:Tech stack'),
      value_text: 'TypeScript, React, Node.js, PostgreSQL',
    },
    {
      field_id: fieldIdByKey.get('vacancy:Years experience minimum'),
      value_number: 5,
    },
    {
      field_id: fieldIdByKey.get('vacancy:Remote allowed'),
      value_boolean: true,
    },
    {
      field_id: fieldIdByKey.get('vacancy:Seniority level'),
      value_option: 'Senior',
    },
  ].filter((v) => v.field_id)

  for (const v of values) {
    const payload = {
      organization_id: orgId,
      field_id: v.field_id!,
      entity_id: vacancy.id,
      value_text: 'value_text' in v ? (v as { value_text: string }).value_text : null,
      value_number: 'value_number' in v ? (v as { value_number: number }).value_number : null,
      value_boolean: 'value_boolean' in v ? (v as { value_boolean: boolean }).value_boolean : null,
      value_option: 'value_option' in v ? (v as { value_option: string }).value_option : null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await admin
      .from('custom_field_values')
      .upsert(payload, { onConflict: 'field_id,entity_id' })
    if (error) console.log(`    value upsert failed: ${error.message}`)
  }
  console.log('  SR Engineer custom field values set')
}

async function main(): Promise<void> {
  console.log(`Seeding demo org on ${SUPABASE_URL}\n`)

  console.log('Users:')
  const ownerId = await ensureUser(OWNER_EMAIL, 'Anna Schmidt')
  const adminId = await ensureUser(ADMIN_EMAIL, 'Daniel Lee')

  console.log('\nOrganization:')
  const orgId = await ensureOrganization()

  console.log('\nProfiles:')
  await ensureProfile(ownerId, orgId, 'Anna Schmidt', OWNER_EMAIL, 'owner')
  await ensureProfile(adminId, orgId, 'Daniel Lee', ADMIN_EMAIL, 'admin')
  console.log('  profiles upserted')

  console.log('\nSubscription:')
  await ensureSubscription(orgId)

  console.log('\nVacancies:')
  await ensureVacancies(orgId, ownerId)

  console.log('\nCandidates:')
  await ensureCandidates(orgId, ownerId)

  console.log('\nApplications (pipeline):')
  await ensureApplications(orgId, ownerId)

  console.log('\nVacancy questions (Senior Software Engineer):')
  await ensureVacancyQuestions(orgId)

  console.log('\nCustom field schema:')
  const fieldIdByKey = await ensureCustomFields(orgId)

  console.log('\nCustom field values (Senior Software Engineer):')
  await setSrEngineerCustomValues(orgId, fieldIdByKey)

  console.log('\n--- DONE ---')
  console.log('Owner login:', OWNER_EMAIL)
  console.log('Admin login:', ADMIN_EMAIL)
  console.log('Password:   ', DEMO_PASSWORD)
  console.log('\nAdd to .env.local for the screenshot script:')
  console.log(`  STAGING_DEMO_EMAIL=${OWNER_EMAIL}`)
  console.log(`  STAGING_DEMO_PASSWORD=${DEMO_PASSWORD}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
