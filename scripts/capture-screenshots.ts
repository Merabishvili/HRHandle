/**
 * Capture the guide screenshots in English, Georgian and Russian in one run.
 *
 *   npm run guide:screenshots                                  # every topic, all languages
 *   npm run guide:screenshots -- --topic post-a-vacancy        # one topic (comma-separate for more)
 *   npm run guide:screenshots -- --locale ka                   # one language
 *   npm run guide:screenshots -- --preview /tmp/guide-preview  # also write EN|KA|RU side-by-side sheets
 *
 * Runs against SCREENSHOT_BASE_URL (default http://localhost:3123 — start it
 * with `npm run guide:serve`, a local production build on the staging
 * database). For the deployed staging, also set VERCEL_PROTECTION_BYPASS.
 * Seed the demo companies first: `npm run guide:seed`.
 *
 * Each language gets its own browser, logged in as that language's demo owner
 * (scripts/guide-demo-data.ts) with the matching NEXT_LOCALE cookie, and the
 * three run at the same time. Flows (scripts/screenshot-config.ts) find
 * elements by id/role and by the app's own translated labels, so one flow
 * works in every language. Shots are saved as WebP under
 * public/guide/screenshots/<locale>/ and their pixel sizes recorded in
 * content/guides/screenshots.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/locales'
import { DEMO } from './guide-demo-data'
import { FLOWS, type Mark, type ShotContext, type ShotOptions } from './screenshot-config'

const BASE_URL = (process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3123').replace(/\/$/, '')
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
// Only needed to capture from a Vercel-protected deployment (e.g. staging.hrhandle.com).
const VERCEL_BYPASS = process.env.VERCEL_PROTECTION_BYPASS
const VIEWPORT = { width: 1440, height: 900 }
const OUT_DIR = path.join(process.cwd(), 'public', 'guide', 'screenshots')
const SIZES_FILE = path.join(process.cwd(), 'content', 'guides', 'screenshots.json')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY (.env.local).')
  process.exit(1)
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function argList(flag: string): string[] | undefined {
  const i = process.argv.indexOf(flag)
  return i > -1 ? (process.argv[i + 1] ?? '').split(',').filter(Boolean) : undefined
}

// ── App translations (the same catalog the UI renders) ─────────────────────

type Messages = Record<string, unknown>
const messageCache = new Map<Locale, Messages>()

function translator(locale: Locale) {
  if (!messageCache.has(locale)) {
    const file = path.join(process.cwd(), 'messages', `${locale}.json`)
    messageCache.set(locale, JSON.parse(fs.readFileSync(file, 'utf8')))
  }
  const messages = messageCache.get(locale)!
  return (key: string, values: Record<string, string | number> = {}): string => {
    const raw = key.split('.').reduce<unknown>((node, part) => (node as Messages | undefined)?.[part], messages)
    if (typeof raw !== 'string') throw new Error(`[${locale}] missing message "${key}"`)
    return raw
      .replace(/\{(\w+)\}/g, (m, name: string) => (name in values ? String(values[name]) : m))
      .replace(/<\/?\w+>/g, '') // rich-text tags render as plain text
  }
}

// ── Login: a real Supabase session in the app's own cookie format ─────────

async function signIn(context: BrowserContext, email: string, locale: Locale): Promise<void> {
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr || !link.properties?.hashed_token) throw linkErr ?? new Error('generateLink returned no token')

  // Let @supabase/ssr encode (and chunk) the session cookies exactly as the app does.
  const jar: { name: string; value: string }[] = []
  const ssr = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [], setAll: (list) => void jar.push(...list) },
  })
  const { error } = await ssr.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token })
  if (error) throw error
  await new Promise((r) => setTimeout(r, 50))
  if (!jar.length) throw new Error('no session cookies were produced')

  const url = new URL(BASE_URL)
  await context.addCookies(
    [...jar, { name: 'NEXT_LOCALE', value: locale }].map((c) => ({
      name: c.name,
      value: c.value,
      domain: url.hostname,
      path: '/',
      secure: url.protocol === 'https:',
      sameSite: 'Lax' as const,
    })),
  )
}

// ── Markers: red boxes with an optional number badge ───────────────────────

async function drawMarks(page: Page, marks: Mark[]): Promise<void> {
  const rects: { x: number; y: number; w: number; h: number; n: number | null; left: boolean }[] = []
  for (const [i, m] of marks.entries()) {
    const box = await m.target.boundingBox({ timeout: 5_000 }).catch(() => null)
    if (!box) throw new Error(`marker ${m.n ?? `#${i + 1}`} not found: ${m.target}`)
    const pad = m.pad ?? 4
    rects.push({
      x: box.x - pad,
      y: box.y - pad,
      w: box.width + pad * 2,
      h: box.height + pad * 2,
      n: m.n ?? null,
      left: m.badge === 'left',
    })
  }
  await page.evaluate((items) => {
    const layer = document.createElement('div')
    layer.id = '__guide_marks__'
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none'
    for (const r of items) {
      const box = document.createElement('div')
      box.style.cssText = [
        'position:absolute',
        `left:${r.x + window.scrollX}px`,
        `top:${r.y + window.scrollY}px`,
        `width:${r.w}px`,
        `height:${r.h}px`,
        'border:3px solid #ef4444',
        'border-radius:8px',
        'box-shadow:0 0 0 3px rgba(239,68,68,0.18)',
      ].join(';')
      layer.appendChild(box)
      if (r.n !== null) {
        const badge = document.createElement('div')
        badge.textContent = String(r.n)
        // 'left': outside the box, so it never covers a field label; else on the corner.
        const bx = r.left ? r.x - 34 : r.x - 13
        const by = r.left ? (r.h <= 44 ? r.y + r.h / 2 - 13 : r.y + 4) : r.y - 13
        badge.style.cssText = [
          'position:absolute',
          `left:${bx + window.scrollX}px`,
          `top:${by + window.scrollY}px`,
          'width:26px',
          'height:26px',
          'border-radius:50%',
          'background:#ef4444',
          'color:#fff',
          'font:700 14px/26px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
          'text-align:center',
          'box-shadow:0 1px 4px rgba(0,0,0,0.25)',
        ].join(';')
        layer.appendChild(badge)
      }
    }
    document.body.appendChild(layer)
  }, rects)
}

const clearMarks = (page: Page) => page.evaluate(() => document.getElementById('__guide_marks__')?.remove())

// ── Capture ─────────────────────────────────────────────────────────────

const sizes: Record<string, Record<string, [number, number]>> = fs.existsSync(SIZES_FILE)
  ? JSON.parse(fs.readFileSync(SIZES_FILE, 'utf8'))
  : {}

/**
 * Grow the window to the page's full height. A Playwright full-page capture
 * scrolls, which draws the fixed sidebar and sticky header in the wrong place;
 * a tall window lays the page out exactly as a tall screen would.
 */
async function fitWindowToPage(page: Page): Promise<number> {
  const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight))
  const fitted = Math.min(Math.max(height, VIEWPORT.height), 3200)
  if (fitted !== VIEWPORT.height) {
    await page.setViewportSize({ width: VIEWPORT.width, height: fitted })
    await page.waitForTimeout(300)
  }
  return fitted
}

async function takeShot(page: Page, locale: Locale, name: string, opts: ShotOptions = {}): Promise<void> {
  // Park the mouse (no hover states; a hovered toast never times out), then let
  // toasts ("Vacancy published.") finish, so every language's shot matches.
  await page.mouse.move(1, 1)
  await page.locator('[data-sonner-toast]').first().waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {})
  const windowHeight = opts.fullPage || opts.clip ? await fitWindowToPage(page) : VIEWPORT.height
  if (opts.marks?.length) await drawMarks(page, opts.marks)
  await page.waitForTimeout(200)

  let clip: { x: number; y: number; width: number; height: number } | undefined
  if (opts.clip) {
    const b = await opts.clip.boundingBox()
    if (!b) throw new Error(`clip target for "${name}" is not visible`)
    const pad = opts.clipPad ?? 24
    const x = Math.max(0, b.x - pad)
    const y = Math.max(0, b.y - pad)
    clip = {
      x,
      y,
      width: Math.min(VIEWPORT.width - x, b.width + pad * 2),
      height: Math.min(windowHeight - y, b.height + pad * 2),
    }
  }
  const png = await page.screenshot({ ...(clip ? { clip } : {}), animations: 'disabled', caret: 'hide' })
  if (opts.marks?.length) await clearMarks(page)
  if (windowHeight !== VIEWPORT.height) await page.setViewportSize(VIEWPORT)

  fs.mkdirSync(path.join(OUT_DIR, locale), { recursive: true })
  const image = sharp(png)
  const { width = 0, height = 0 } = await image.metadata()
  await image.webp({ quality: 82 }).toFile(path.join(OUT_DIR, locale, `${name}.webp`))
  ;(sizes[locale] ??= {})[name] = [width, height]
  console.log(`  [${locale}] ✓ ${name}  ${width}×${height}`)
}

async function runLocale(browser: Browser, locale: Locale, topics: Set<string> | null): Promise<string[]> {
  const demo = DEMO[locale]
  const owner = demo.users.find((u) => u.role === 'owner')!
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: locale === 'ka' ? 'ka-GE' : locale === 'ru' ? 'ru-RU' : 'en-US',
    ...(VERCEL_BYPASS
      ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': VERCEL_BYPASS, 'x-vercel-set-bypass-cookie': 'true' } }
      : {}),
  })
  await signIn(context, owner.email, locale)
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  const taken: string[] = []

  const ctx: ShotContext = {
    page,
    locale,
    demo,
    admin,
    t: translator(locale),
    goto: async (p) => {
      await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle', timeout: 45_000 })
    },
    shot: async (name, opts) => {
      await takeShot(page, locale, name, opts)
      taken.push(name)
    },
  }

  for (const flow of FLOWS) {
    if (topics && !topics.has(flow.topic)) continue
    console.log(`[${locale}] → ${flow.topic}`)
    try {
      await flow.run(ctx)
    } catch (err) {
      const debug = path.join(process.cwd(), '.next', `guide-error-${locale}-${flow.topic}.png`)
      await page.screenshot({ path: debug }).catch(() => {})
      console.error(`  [${locale}] ✗ ${flow.topic}: ${(err as Error).message}\n    page: ${page.url()}\n    debug screenshot: ${debug}`)
    } finally {
      await flow.cleanup?.(ctx).catch((err) => console.error(`  [${locale}] cleanup failed: ${(err as Error).message}`))
    }
  }
  await context.close()
  return taken
}

/** EN | KA | RU side by side, for a quick visual check of a whole run. */
async function writePreviews(dir: string, names: string[], locales: Locale[]): Promise<void> {
  fs.mkdirSync(dir, { recursive: true })
  const W = 720
  const GAP = 12
  for (const name of names) {
    const tiles = await Promise.all(
      locales.map((l) =>
        sharp(path.join(OUT_DIR, l, `${name}.webp`)).resize({ width: W }).png().toBuffer({ resolveWithObject: true }),
      ),
    )
    const height = Math.max(...tiles.map((t) => t.info.height))
    await sharp({
      create: { width: W * tiles.length + GAP * (tiles.length - 1), height, channels: 3, background: '#d4d4d8' },
    })
      .composite(tiles.map((t, i) => ({ input: t.data, left: i * (W + GAP), top: 0 })))
      .jpeg({ quality: 78 })
      .toFile(path.join(dir, `${name}.jpg`))
  }
  console.log(`\nPreviews (${locales.join(' | ')}): ${dir}`)
}

async function main(): Promise<void> {
  const topicArg = argList('--topic')
  const localeArg = argList('--locale')
  const previewDir = argList('--preview')?.[0]
  const locales = (localeArg ?? [...LOCALES]).filter(isLocale)
  const topics = topicArg ? new Set(topicArg) : null

  const browser = await chromium.launch({ headless: true })
  try {
    console.log(`Capturing ${topics ? [...topics].join(', ') : 'all topics'} in ${locales.join(', ')} from ${BASE_URL}\n`)
    const results = await Promise.all(locales.map((l) => runLocale(browser, l, topics)))

    const sorted = Object.fromEntries(
      LOCALES.map((l) => [l, Object.fromEntries(Object.entries(sizes[l] ?? {}).sort(([a], [b]) => a.localeCompare(b)))]),
    )
    fs.writeFileSync(SIZES_FILE, JSON.stringify(sorted, null, 2) + '\n')

    if (previewDir) {
      const inAll = results[0]!.filter((n) => results.every((r) => r.includes(n)))
      await writePreviews(previewDir, inAll, locales)
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
