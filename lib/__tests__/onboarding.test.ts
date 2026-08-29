import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@supabase/supabase-js'

// Mock the admin client so we can capture the values runOnboarding writes
// to the organizations / profiles tables. The chainable query API mirrors the
// surface runOnboarding actually uses (.from().insert().select().single(),
// .from().select().eq().maybeSingle(), .from().upsert(), .from().delete().eq()).
const { adminMock, calls } = vi.hoisted(() => {
  const calls = {
    organizationInserts: [] as Array<Record<string, unknown>>,
    profileUpserts: [] as Array<Record<string, unknown>>,
  }

  function makeChain(table: string) {
    return {
      insert: (row: Record<string, unknown>) => {
        if (table === 'organizations') calls.organizationInserts.push(row)
        if (table === 'subscriptions') {
          /* not asserted in these tests */
        }
        if (table === 'rejection_reasons') {
          return {
            select: () => ({
              single: async () => ({ data: { id: 'reason-1' }, error: null }),
            }),
          }
        }
        if (table === 'rejection_templates') {
          return Promise.resolve({ data: null, error: null })
        }
        return {
          select: () => ({
            single: async () => ({
              data: table === 'organizations' ? { id: 'org-1' } : null,
              error: null,
            }),
          }),
          // for subscriptions: insert returns a promise directly
          then: (resolve: (v: { data: null; error: null }) => unknown) =>
            resolve({ data: null, error: null }),
        }
      },
      upsert: (row: Record<string, unknown>) => {
        if (table === 'profiles') calls.profileUpserts.push(row)
        return Promise.resolve({ data: null, error: null })
      },
      select: (_cols?: string) => ({
        eq: (_col: string, _val: unknown) => ({
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
        }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
    }
  }

  const adminMock = {
    from: (table: string) => makeChain(table),
    // Main-pipeline seeding calls admin.rpc('seed_org_pipeline_stage_template_defaults').
    // Best-effort in the code, so a no-op success is enough here.
    rpc: async () => ({ data: null, error: null }),
  }

  return { adminMock, calls }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => adminMock,
}))

import { runOnboarding } from '@/lib/onboarding'

function makeUser(metadata: Record<string, unknown> = {}): User {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'alex@example.com',
    user_metadata: metadata,
  } as unknown as User
}

describe('runOnboarding name resolution', () => {
  beforeEach(() => {
    calls.organizationInserts = []
    calls.profileUpserts = []
  })

  it('uses opts.companyName / opts.fullName when provided (OAuth flow)', async () => {
    const user = makeUser({ full_name: 'Provider Name' }) // no company_name
    const result = await runOnboarding(user, {
      companyName: 'Acme Recruiting',
      fullName: 'Alex M',
    })

    expect(result.success).toBe(true)
    expect(calls.organizationInserts[0]?.name).toBe('Acme Recruiting')
    expect(calls.profileUpserts[0]?.full_name).toBe('Alex M')
  })

  it('falls back to user_metadata when opts are not provided (email signup)', async () => {
    const user = makeUser({ full_name: 'Email User', company_name: 'Metadata Co' })
    const result = await runOnboarding(user)

    expect(result.success).toBe(true)
    expect(calls.organizationInserts[0]?.name).toBe('Metadata Co')
    expect(calls.profileUpserts[0]?.full_name).toBe('Email User')
  })

  it('falls back to defaults when neither opts nor metadata have values', async () => {
    const user = makeUser({})
    const result = await runOnboarding(user)

    expect(result.success).toBe(true)
    expect(calls.organizationInserts[0]?.name).toBe('New Organization')
    expect(calls.profileUpserts[0]?.full_name).toBe('New User')
  })

  it('opts override user_metadata when both are present', async () => {
    const user = makeUser({ full_name: 'Meta Name', company_name: 'Meta Co' })
    const result = await runOnboarding(user, {
      companyName: 'Opts Co',
      fullName: 'Opts Name',
    })

    expect(result.success).toBe(true)
    expect(calls.organizationInserts[0]?.name).toBe('Opts Co')
    expect(calls.profileUpserts[0]?.full_name).toBe('Opts Name')
  })

  it('whitespace-only opts fall back to metadata', async () => {
    const user = makeUser({ full_name: 'Meta Name', company_name: 'Meta Co' })
    const result = await runOnboarding(user, {
      companyName: '   ',
      fullName: '   ',
    })

    expect(result.success).toBe(true)
    expect(calls.organizationInserts[0]?.name).toBe('Meta Co')
    expect(calls.profileUpserts[0]?.full_name).toBe('Meta Name')
  })
})

describe('runOnboarding public_page_slug generation', () => {
  beforeEach(() => {
    calls.organizationInserts = []
    calls.profileUpserts = []
  })

  it('transliterates a Georgian company name into a Latin slug', async () => {
    const user = makeUser({ company_name: 'კომპანია' })
    const result = await runOnboarding(user)

    expect(result.success).toBe(true)
    // The org name is preserved verbatim; only the URL slug is romanized.
    expect(calls.organizationInserts[0]?.name).toBe('კომპანია')
    expect(calls.organizationInserts[0]?.public_page_slug).toBe('kompania')
  })

  it('transliterates a Russian company name into a Latin slug', async () => {
    const user = makeUser({ company_name: 'Компания' })
    const result = await runOnboarding(user)

    expect(result.success).toBe(true)
    expect(calls.organizationInserts[0]?.public_page_slug).toBe('kompaniya')
  })

  it('never produces a lone "-" slug for a spaced non-Latin name (regression)', async () => {
    const user = makeUser({ company_name: 'ჰრ ჰენდლი' })
    const result = await runOnboarding(user)

    expect(result.success).toBe(true)
    expect(calls.organizationInserts[0]?.public_page_slug).toBe('hr-hendli')
  })
})

describe('runOnboarding content locale seeding', () => {
  beforeEach(() => {
    calls.organizationInserts = []
    calls.profileUpserts = []
  })

  it('seeds the org content locale from opts.locale (OAuth flow)', async () => {
    const user = makeUser({})
    await runOnboarding(user, { companyName: 'Acme', locale: 'ka' })

    expect(calls.organizationInserts[0]?.default_content_locale).toBe('ka')
    // `en` is always kept enabled as a fallback.
    expect(calls.organizationInserts[0]?.enabled_content_locales).toEqual(['ka', 'en'])
  })

  it('falls back to user_metadata.locale (email signup)', async () => {
    const user = makeUser({ company_name: 'Acme', locale: 'ru' })
    await runOnboarding(user)

    expect(calls.organizationInserts[0]?.default_content_locale).toBe('ru')
    expect(calls.organizationInserts[0]?.enabled_content_locales).toEqual(['ru', 'en'])
  })

  it('defaults to English when no locale is available', async () => {
    const user = makeUser({ company_name: 'Acme' })
    await runOnboarding(user)

    expect(calls.organizationInserts[0]?.default_content_locale).toBe('en')
    expect(calls.organizationInserts[0]?.enabled_content_locales).toEqual(['en'])
  })

  it('ignores an invalid locale value and defaults to English', async () => {
    const user = makeUser({ company_name: 'Acme', locale: 'xx' })
    await runOnboarding(user)

    expect(calls.organizationInserts[0]?.default_content_locale).toBe('en')
  })
})
