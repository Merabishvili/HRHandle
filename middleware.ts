import { updateSession } from '@/lib/supabase/middleware'
import { buildCsp, generateNonce } from '@/lib/security-headers'
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/locales'
import { NextResponse, type NextRequest } from 'next/server'

const PREFIXES = new Set<string>(LOCALES) // 'en' | 'ka' | 'ru'

/**
 * i18n Slice 3b — public SEO routing for the careers page only. `as-needed`
 * locale prefix: English is canonical (`/jobs/...`), other locales are prefixed
 * (`/ka/jobs/...`). This branch is deliberately scoped to `/jobs` paths so the
 * dashboard's auth + session handling in `updateSession` stays completely
 * untouched. Public pages still need the CSP nonce (strict-dynamic), so we
 * inject `x-nonce` + the CSP header ourselves here.
 */
function handleJobsLocale(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  const seg = pathname.split('/') // ['', 'jobs', slug] or ['', 'ka', 'jobs', slug]
  const unprefixed = seg[1] === 'jobs'
  const prefixed = !!seg[1] && PREFIXES.has(seg[1]) && seg[2] === 'jobs'
  if (!unprefixed && !prefixed) return null

  // Canonicalize the redundant English prefix: /en/jobs/... → /jobs/...
  if (prefixed && seg[1] === DEFAULT_LOCALE) {
    const url = request.nextUrl.clone()
    url.pathname = '/' + seg.slice(2).join('/')
    return NextResponse.redirect(url)
  }

  const nonce = generateNonce()
  const csp = buildCsp(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  let response: NextResponse
  if (unprefixed) {
    // Rewrite the canonical URL onto the [locale] tree (URL unchanged). Because
    // any explicit /en/jobs is redirected to the bare path above, the page only
    // ever sees locale === DEFAULT_LOCALE for THIS canonical path — it uses that
    // to render in the org's default content locale (#15).
    const url = request.nextUrl.clone()
    url.pathname = `/${DEFAULT_LOCALE}${pathname}`
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } })
  }
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export async function middleware(request: NextRequest) {
  // Supabase falls back to the Site URL when redirectTo isn't matched, producing
  // /?code=... at the root. Forward it to the real callback handler.
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return NextResponse.redirect(url)
  }

  // Public careers-page locale routing (isolated — never touches auth/session).
  const jobsResponse = handleJobsLocale(request)
  if (jobsResponse) return jobsResponse

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
