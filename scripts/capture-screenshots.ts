/**
 * Capture annotated screenshots for the guide pages.
 *
 * Usage:
 *   npm run guide:screenshots
 *
 * Reads STAGING_DEMO_EMAIL, STAGING_DEMO_PASSWORD, and (optional)
 * SCREENSHOT_BASE_URL from .env.local. Defaults to https://staging.hrhandle.com.
 *
 * For each shot defined in screenshot-config.ts the script:
 *   1. Reuses a logged-in browser context.
 *   2. Navigates to the target page.
 *   3. Runs any pre-actions (fills, clicks).
 *   4. Injects DOM-based annotation overlays (red arrows / numbered boxes).
 *   5. Saves a PNG to the configured output path.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { SHOTS, type Annotation, type ShotConfig } from './screenshot-config'

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'https://staging.hrhandle.com'
const EMAIL = process.env.STAGING_DEMO_EMAIL
const PASSWORD = process.env.STAGING_DEMO_PASSWORD
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VERCEL_BYPASS = process.env.VERCEL_PROTECTION_BYPASS
const VIEWPORT = { width: 1440, height: 900 }

if (!EMAIL || !PASSWORD) {
  console.error(
    'Missing STAGING_DEMO_EMAIL or STAGING_DEMO_PASSWORD environment variables.\n' +
      'Add them to .env.local (never commit them).'
  )
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'These are needed to bypass the Turnstile captcha via the admin-generated magic link flow.'
  )
  process.exit(1)
}

/**
 * Build a session for the demo user and inject it as a cookie into the
 * Playwright browser context.
 *
 * Direct password sign-in is blocked by the Supabase project's Turnstile
 * captcha. Instead, the admin client (with the service_role key) generates
 * a one-time magic-link token; the anon client then calls verifyOtp with
 * that token to obtain a real session. verifyOtp does not require a
 * captcha because it is not a credential check.
 *
 * The PASSWORD env var is kept for documentation / manual logins; it is
 * not used by this flow.
 */
async function authenticateContext(context: BrowserContext): Promise<void> {
  void PASSWORD
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL!,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw linkErr ?? new Error('generateLink returned no hashed_token')
  }

  const anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  })
  if (error || !data.session) {
    throw error ?? new Error('verifyOtp returned no session')
  }
  // Supabase SSR stores the session as a JSON-encoded cookie. Cookie name is
  // sb-<project-ref>-auth-token; for sessions >4KB it is split into chunks
  // (sb-<ref>-auth-token.0, .1, …). For a single-session login this fits in
  // one cookie.
  const ref = new URL(SUPABASE_URL!).host.split('.')[0]
  const cookieName = `sb-${ref}-auth-token`
  const cookieValue = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  })
  const domain = new URL(BASE_URL).hostname
  await context.addCookies([
    {
      name: cookieName,
      value: `base64-${Buffer.from(cookieValue).toString('base64')}`,
      domain,
      path: '/',
      httpOnly: false,
      secure: BASE_URL.startsWith('https://'),
      sameSite: 'Lax',
      expires: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    },
  ])
}

async function injectAnnotations(page: Page, annotations: Annotation[]): Promise<void> {
  // Run inside the page; positions each overlay relative to its target.
  await page.evaluate((items: Annotation[]) => {
    const layer = document.createElement('div')
    layer.id = '__guide_overlay__'
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:2147483647',
    ].join(';')
    document.body.appendChild(layer)

    items.forEach((a, i) => {
      const target = document.querySelector(a.targetSelector) as HTMLElement | null
      if (!target) {
        console.warn(`Annotation target not found: ${a.targetSelector}`)
        return
      }
      const r = target.getBoundingClientRect()
      const num = i + 1

      // Box outline around the target.
      if (a.style === 'box') {
        const box = document.createElement('div')
        box.style.cssText = [
          'position:fixed',
          `left:${r.left - 4}px`,
          `top:${r.top - 4}px`,
          `width:${r.width + 8}px`,
          `height:${r.height + 8}px`,
          'border:3px solid #ef4444',
          'border-radius:6px',
          'box-shadow:0 0 0 2px rgba(239,68,68,0.25)',
        ].join(';')
        layer.appendChild(box)
      }

      // Label position.
      let lx = 0
      let ly = 0
      switch (a.position) {
        case 'right':
          lx = r.right + 16
          ly = r.top + r.height / 2 - 14
          break
        case 'left':
          lx = r.left - 200
          ly = r.top + r.height / 2 - 14
          break
        case 'top':
          lx = r.left + r.width / 2 - 100
          ly = r.top - 44
          break
        case 'bottom':
          lx = r.left + r.width / 2 - 100
          ly = r.bottom + 16
          break
      }

      const label = document.createElement('div')
      label.style.cssText = [
        'position:fixed',
        `left:${lx}px`,
        `top:${ly}px`,
        'min-width:80px',
        'max-width:220px',
        'padding:6px 10px',
        'background:#ef4444',
        'color:#ffffff',
        'font:600 12px/1.3 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
        'border-radius:6px',
        'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
        'text-align:center',
      ].join(';')
      label.textContent = a.style === 'box' ? a.label : `${num}. ${a.label.replace(/^\d+\.\s*/, '')}`
      layer.appendChild(label)

      // Arrow for non-box style.
      if (a.style === 'arrow') {
        const arrow = document.createElement('div')
        let ax = 0
        let ay = 0
        let rot = 0
        switch (a.position) {
          // The base polygon is a right-pointing arrow. Rotation makes the tip
          // point AT the target.
          case 'right':
            // Label is to the right of target; arrow tip should point LEFT.
            ax = r.right + 2
            ay = r.top + r.height / 2 - 6
            rot = 180
            break
          case 'left':
            // Label is to the left of target; arrow tip should point RIGHT.
            ax = r.left - 18
            ay = r.top + r.height / 2 - 6
            rot = 0
            break
          case 'top':
            // Label is above target; arrow tip should point DOWN.
            ax = r.left + r.width / 2 - 6
            ay = r.top - 18
            rot = 90
            break
          case 'bottom':
            // Label is below target; arrow tip should point UP.
            ax = r.left + r.width / 2 - 6
            ay = r.bottom + 2
            rot = 270
            break
        }
        arrow.style.cssText = [
          'position:fixed',
          `left:${ax}px`,
          `top:${ay}px`,
          'width:14px',
          'height:14px',
          'background:#ef4444',
          'clip-path:polygon(0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%)',
          `transform:rotate(${rot}deg)`,
        ].join(';')
        layer.appendChild(arrow)
      }
    })
  }, annotations)
}

async function clearAnnotations(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('__guide_overlay__')?.remove()
  })
}

async function captureShot(context: BrowserContext, shot: ShotConfig): Promise<void> {
  const page = await context.newPage()
  await page.setViewportSize(VIEWPORT)
  console.log(`→ ${shot.name}`)

  try {
    await page.goto(`${BASE_URL}${shot.url}`, { waitUntil: 'networkidle', timeout: 30_000 })
    if (shot.preActions) {
      await shot.preActions(page)
      await page.waitForLoadState('networkidle').catch(() => {})
    }

    // Give layout one extra paint.
    await page.waitForTimeout(300)

    if (shot.annotations?.length) {
      await injectAnnotations(page, shot.annotations)
      await page.waitForTimeout(100)
    }

    const outAbs = path.join(process.cwd(), shot.output)
    fs.mkdirSync(path.dirname(outAbs), { recursive: true })
    await page.screenshot({ path: outAbs, fullPage: shot.fullPage ?? false })
    console.log(`  ✓ ${shot.output}`)

    if (shot.annotations?.length) {
      await clearAnnotations(page)
    }
  } catch (err) {
    console.error(`  ✗ failed: ${(err as Error).message}`)
  } finally {
    await page.close()
  }
}

async function main(): Promise<void> {
  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: VIEWPORT,
      extraHTTPHeaders: VERCEL_BYPASS
        ? {
            'x-vercel-protection-bypass': VERCEL_BYPASS,
            'x-vercel-set-bypass-cookie': 'true',
          }
        : undefined,
    })

    console.log(`Authenticating with Supabase as ${EMAIL}…`)
    await authenticateContext(context)
    console.log('Session injected. Capturing shots…\n')

    for (const shot of SHOTS) {
      await captureShot(context, shot)
    }

    await context.close()
    console.log('\nDone.')
  } finally {
    await browser?.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
