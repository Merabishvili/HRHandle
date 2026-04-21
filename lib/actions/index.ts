'use server'

import { createClient } from '@/lib/supabase/server'

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

/** Resolves the authenticated user + their org. Returns null if not authed. */
export async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return null

  return {
    supabase,
    userId: user.id,
    orgId: profile.organization_id as string,
    role: profile.role as 'owner' | 'admin' | 'member',
  }
}

type LimitResource = 'candidate' | 'vacancy'

/** Returns an error string if the org is at or above their plan limit, null otherwise. */
export async function checkPlanLimit(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  resource: LimitResource
): Promise<string | null> {
  const { data: sub } = await ctx.supabase
    .from('subscriptions')
    .select('candidate_limit, vacancy_limit, status')
    .eq('organization_id', ctx.orgId)
    .single()

  if (!sub) return null // no subscription row → allow (shouldn't happen)

  if (resource === 'candidate') {
    if (!sub.candidate_limit) return null
    const { count } = await ctx.supabase
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
    if ((count ?? 0) >= sub.candidate_limit) {
      return `You've reached your plan limit of ${sub.candidate_limit} candidates. Upgrade to add more.`
    }
  }

  if (resource === 'vacancy') {
    if (!sub.vacancy_limit) return null
    const { count } = await ctx.supabase
      .from('vacancies')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .is('archived_at', null)
    if ((count ?? 0) >= sub.vacancy_limit) {
      return `You've reached your plan limit of ${sub.vacancy_limit} active vacancies. Upgrade to add more.`
    }
  }

  return null
}
