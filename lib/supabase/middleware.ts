import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { buildCsp, generateNonce } from '@/lib/security-headers'

export async function updateSession(request: NextRequest) {
  // Per-request CSP nonce (S-014 / C-015). Forward to the app via the
  // `x-nonce` request header so server components can read it via
  // `headers().get('x-nonce')` and stamp it on inline <script> tags.
  // Next.js auto-nonces its own framework scripts when this header is set.
  const nonce = generateNonce()
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', csp)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (
    (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/pipeline') ||
      pathname.startsWith('/onboarding')) &&
    !user
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // MFA (G-032) — gate dashboard routes when the user has enrolled but the
  // session is still AAL1, or when org policy requires enrollment and the
  // user hasn't enrolled. Excludes the security + challenge surfaces so the
  // user can actually reach the pages that resolve the redirect.
  const isDashboardPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/pipeline') ||
    pathname.startsWith('/vacancies') ||
    pathname.startsWith('/candidates') ||
    pathname.startsWith('/interviews') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/subscription')

  // The enrollment UI (TwoFactorSection) AND the org MFA-policy toggle both live
  // on /settings/security — it MUST be exempt, otherwise an admin who turns on
  // "require MFA" before enrolling can never reach the page to enroll or undo it.
  const isExemptMfaPath =
    pathname === '/settings/security' ||
    pathname.startsWith('/settings/security/') ||
    pathname === '/auth/mfa-challenge' ||
    pathname.startsWith('/api/') ||
    pathname === '/auth/logout'

  if (user && isDashboardPath && !isExemptMfaPath) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role, mfa_enrolled')
        .eq('id', user.id)
        .single()

      if (profile?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('require_mfa, require_mfa_for_admins')
          .eq('id', profile.organization_id)
          .single()

        const role = profile.role as 'owner' | 'admin' | 'member'
        const isAdmin = role === 'owner' || role === 'admin'
        const requireForUser = !!org?.require_mfa || (!!org?.require_mfa_for_admins && isAdmin)

        if (!profile.mfa_enrolled && requireForUser) {
          const url = request.nextUrl.clone()
          url.pathname = '/settings/security'
          url.searchParams.set('enforce', 'mfa')
          return NextResponse.redirect(url)
        }

        if (profile.mfa_enrolled) {
          const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
            const url = request.nextUrl.clone()
            url.pathname = '/auth/mfa-challenge'
            url.searchParams.set('next', pathname + request.nextUrl.search)
            return NextResponse.redirect(url)
          }
        }
      }
    } catch (err) {
      console.error('[middleware] mfa gate failed:', err)
      // Don't block on policy lookup failure.
    }
  }

  return response
}