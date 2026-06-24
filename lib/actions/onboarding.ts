'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runOnboarding } from '@/lib/onboarding'

const CompanyOnboardingSchema = z.object({
  fullName: z.string().trim().min(1, 'Please enter your name').max(100, 'Name is too long'),
  companyName: z.string().trim().min(1, 'Please enter your company name').max(100, 'Company name is too long'),
})

export type CompanyOnboardingResult =
  | { success: true }
  | { success: false; error: string }

export async function completeCompanyOnboarding(input: {
  fullName: string
  companyName: string
}): Promise<CompanyOnboardingResult> {
  const parsed = CompanyOnboardingSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Idempotency: if onboarding already completed (e.g. double-submit, back button,
  // or the user opened this page after their org was created via another tab),
  // skip straight to the pipeline rather than creating a second org.
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing?.organization_id) {
    redirect('/pipeline')
  }

  const result = await runOnboarding(user, {
    fullName: parsed.data.fullName,
    companyName: parsed.data.companyName,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  redirect('/pipeline')
}
