import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyZoomDataCompliance } from '@/lib/zoom/meetings'
import { zoomCrcEncryptedToken, verifyZoomSignature } from '@/lib/zoom/webhook'

/**
 * Zoom deauthorization webhook (Marketplace security-review requirement).
 *
 * Two responsibilities:
 *  1. Answer Zoom's endpoint URL-validation (CRC) challenge so the endpoint can
 *     be saved/verified — respond with the plainToken hashed by the app's
 *     Secret Token (`ZOOM_SECRET_TOKEN`).
 *  2. On `app_deauthorized` (a user uninstalls the app): verify the signature,
 *     delete that user's stored Zoom tokens, and confirm deletion to Zoom via
 *     the data-compliance API.
 *
 * Public endpoint (called by Zoom, no session) — trust is established by the
 * HMAC signature, not by auth.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.ZOOM_SECRET_TOKEN
  const raw = await request.text()

  let body: { event?: string; payload?: Record<string, unknown> }
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // 1) URL validation (CRC). Zoom sends a plainToken; we echo it back plus its
  // HMAC-SHA256 hash keyed by the Secret Token, proving we own the secret.
  if (body.event === 'endpoint.url_validation') {
    const plainToken = body.payload?.plainToken
    if (!secret || typeof plainToken !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    return NextResponse.json({ plainToken, encryptedToken: zoomCrcEncryptedToken(plainToken, secret) })
  }

  // 2) Verify the webhook signature for real events.
  if (secret) {
    const ts = request.headers.get('x-zm-request-timestamp') ?? ''
    const signature = request.headers.get('x-zm-signature') ?? ''
    if (!verifyZoomSignature(raw, ts, signature, secret)) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }
  }

  // 3) Deauthorization — delete the user's tokens, then confirm to Zoom.
  if (body.event === 'app_deauthorized') {
    const p = body.payload ?? {}
    const zoomUserId = typeof p.user_id === 'string' ? p.user_id : null
    const accountId = typeof p.account_id === 'string' ? p.account_id : null

    if (zoomUserId) {
      const admin = createAdminClient()
      await admin
        .from('profiles')
        .update({
          zoom_access_token: null,
          zoom_refresh_token: null,
          zoom_token_expiry: null,
          zoom_user_id: null,
        })
        .eq('zoom_user_id', zoomUserId)

      if (accountId) {
        await notifyZoomDataCompliance({
          userId: zoomUserId,
          accountId,
          deauthorizationEventReceived: p,
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
