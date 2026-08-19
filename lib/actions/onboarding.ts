'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runOnboarding } from '@/lib/onboarding'
import { isLocale } from '@/lib/i18n/locales'

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

  // OAuth signups have no locale in metadata (they never hit the sign-up form),
  // so seed the org's content locale from the onboarding page's UI language.
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  const locale = isLocale(cookieLocale) ? cookieLocale : undefined

  const result = await runOnboarding(user, {
    fullName: parsed.data.fullName,
    companyName: parsed.data.companyName,
    ...(locale ? { locale } : {}),
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  // Stamp company_name (+ full_name) into auth metadata so the dashboard layout
  // stops treating this OAuth user as a "first-time" signup. The layout redirects
  // users with no user_metadata.company_name to /onboarding/company; once the org
  // exists the onboarding page redirects back to /pipeline — an onboarding⇄pipeline
  // loop. Email signups set this at sign-up; OAuth signups must set it here.
  // Non-fatal: the org is already created, so a metadata failure just logs.
  try {
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        full_name: parsed.data.fullName,
        company_name: parsed.data.companyName,
      },
    })
  } catch (err) {
    console.error('[onboarding] auth metadata update failed (non-fatal):', err)
  }

  redirect('/pipeline')
}
