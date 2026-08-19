import { Suspense } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Briefcase } from 'lucide-react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { getBlockedCountry } from '@/lib/sanctions'
import { resolveOrgContentLocale } from '@/lib/i18n/org-locale'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  // G-008: country gate. Block new account creation from jurisdictions on the
  // hardcoded sanctions/FATF-call-for-action list. Header is set by Vercel
  // edge; absent in local dev / tests → fails open (does not block).
  const headersList = await headers()
  if (getBlockedCountry(headersList)) {
    redirect('/not-available')
  }

  const { next } = await searchParams
  const safeNext = next?.startsWith('/') ? next : ''

  let inviteEmail: string | undefined
  let inviteOrgName: string | undefined
  let inviteToken: string | undefined
  // Invitees arrive with no NEXT_LOCALE cookie, so the sign-up page would render
  // in English. Render it in the inviting org's content language instead.
  let inviteLocale: string | undefined

  if (safeNext.startsWith('/join')) {
    const token = new URLSearchParams(safeNext.split('?')[1] ?? '').get('token') ?? undefined
    if (token) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      const { data: invite } = await admin
        .from('team_invitations')
        .select('email, organizations(name, default_content_locale, enabled_content_locales)')
        .eq('token', token)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      if (invite) {
        inviteToken = token
        inviteEmail = invite.email ?? undefined
        type OrgRow = { name: string; default_content_locale: string | null; enabled_content_locales: string[] | null }
        const orgs = invite.organizations as OrgRow[] | OrgRow | null
        const org = Array.isArray(orgs) ? orgs[0] : orgs
        if (org) {
          inviteOrgName = org.name
          inviteLocale = resolveOrgContentLocale(org)
        }
      }
    }
  }

  const form = (
    <SignUpForm
      inviteEmail={inviteEmail}
      inviteOrgName={inviteOrgName}
      inviteToken={inviteToken}
    />
  )

  return (
    <div className="min-h-screen bg-background px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">HRHandle</span>
          </Link>
        </div>
        <Suspense>
          {inviteLocale ? (
            <NextIntlClientProvider locale={inviteLocale} messages={await getMessages({ locale: inviteLocale })}>
              {form}
            </NextIntlClientProvider>
          ) : (
            form
          )}
        </Suspense>
      </div>
    </div>
  )
}
