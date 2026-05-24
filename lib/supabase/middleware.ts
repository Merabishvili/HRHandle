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

  if (pathname.startsWith('/dashboard') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return response
}