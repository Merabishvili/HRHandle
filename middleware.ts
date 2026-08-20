import { updateSession } from '@/lib/supabase/middleware'
import { buildCsp, generateNonce } from '@/lib/security-headers'
import { LOCALES } from '@/lib/i18n/locales'
import { NextResponse, type NextRequest } from 'next/server'

const PREFIXES = new Set<string>(LOCALES) // 'en' | 'ka' | 'ru'

/**
 * Public careers page (`/jobs/...`). The org publishes in a single content
 * language, so there is no per-locale path routing — every careers URL is the
 * bare `/jobs/slug`. Legacy locale-prefixed links (`/ka/jobs/...`, from the old
 * multi-language SEO surface) are permanently redirected to the bare path. This
 * branch is scoped to `/jobs` so the dashboard's auth/session handling in
 * `updateSession` stays untouched. Public pages still need the CSP nonce
 * (strict-dynamic), so we inject `x-nonce` + the CSP header ourselves here.
 */
function handleJobsLocale(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  const seg = pathname.split('/') // ['', 'jobs', slug] or ['', 'ka', 'jobs', slug]
  const unprefixed = seg[1] === 'jobs'
  const prefixed = !!seg[1] && PREFIXES.has(seg[1]) && seg[2] === 'jobs'
  if (!unprefixed && !prefixed) return null

  // Legacy locale-prefixed careers links → bare canonical path (308, cacheable).
  if (prefixed) {
    const url = request.nextUrl.clone()
    url.pathname = '/' + seg.slice(2).join('/')
    return NextResponse.redirect(url, 308)
  }

  const nonce = generateNonce()
  const csp = buildCsp(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
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
