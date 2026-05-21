/**
 * Configuration for the guide screenshot capture script.
 *
 * Each shot describes how to land on a page in a known state, what overlays
 * to inject (arrows, numbered boxes), and where to save the resulting image.
 *
 * Add new shots here as guides need them. The capture script is generic and
 * does not need to change.
 */

import type { Page } from 'playwright'

export interface Annotation {
  /** CSS selector for the element the annotation points to. */
  targetSelector: string
  /** Short label shown next to the arrow/box. Keep it under ~20 chars. */
  label: string
  /** Where the arrow/label is positioned relative to the target element. */
  position: 'top' | 'right' | 'bottom' | 'left'
  /** Visual style of the annotation. */
  style: 'arrow' | 'box'
}

export interface ShotConfig {
  /** Used in logs only. */
  name: string
  /** Path relative to BASE_URL (e.g. "/vacancies/new"). */
  url: string
  /** Output path relative to repo root. */
  output: string
  /** Optional steps to run before capturing (fill fields, click buttons, etc.). */
  preActions?: (page: Page) => Promise<void>
  /** Annotations to inject before screenshot. */
  annotations?: Annotation[]
  /** Capture the full page (true) or just the viewport (false, default). */
  fullPage?: boolean
}

export const SHOTS: ShotConfig[] = [
  // ---- post-a-vacancy ----
  {
    name: 'post-a-vacancy-list',
    url: '/vacancies',
    output: 'public/guide/screenshots/post-a-vacancy-list.png',
    preActions: async (page) => {
      await page.waitForSelector('a[href="/vacancies/new"]', { timeout: 15_000 })
    },
    annotations: [
      {
        targetSelector: 'a[href="/vacancies/new"]',
        label: 'Create Vacancy',
        position: 'left',
        style: 'arrow',
      },
    ],
  },
  {
    name: 'post-a-vacancy-form',
    url: '/vacancies/new',
    output: 'public/guide/screenshots/post-a-vacancy-form.png',
    fullPage: false,
    preActions: async (page) => {
      // Tag the Start Date picker button (no stable selector otherwise).
      await page.waitForSelector('#title', { timeout: 15_000 })
      await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label')) as HTMLLabelElement[]
        const startDateLabel = labels.find((l) =>
          l.textContent?.trim().startsWith('Start Date')
        )
        const btn = startDateLabel?.parentElement?.querySelector('button')
        if (btn) btn.setAttribute('data-shot', 'start-date')
      })
    },
    annotations: [
      {
        targetSelector: '#title',
        label: '1. Title',
        position: 'right',
        style: 'arrow',
      },
      {
        targetSelector: '[data-shot="start-date"]',
        label: '2. Start date',
        position: 'right',
        style: 'arrow',
      },
    ],
  },
  {
    name: 'post-a-vacancy-form-description',
    url: '/vacancies/new',
    output: 'public/guide/screenshots/post-a-vacancy-form-description.png',
    preActions: async (page) => {
      await page.waitForSelector('#description', { timeout: 15_000 })
      // Scroll the description field into view.
      await page.evaluate(() => {
        document.querySelector('#description')?.scrollIntoView({ block: 'center' })
      })
      await page.waitForTimeout(400)
    },
    annotations: [
      {
        targetSelector: '#description',
        label: 'About the Job',
        position: 'right',
        style: 'arrow',
      },
    ],
  },
  // ---- team-and-roles ----
  {
    name: 'team-and-roles-page',
    url: '/settings/team',
    output: 'public/guide/screenshots/team-and-roles-page.png',
    preActions: async (page) => {
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
    },
  },

  // ---- custom-fields ----
  {
    name: 'custom-fields-settings',
    url: '/settings/custom-fields',
    output: 'public/guide/screenshots/custom-fields-settings.png',
    preActions: async (page) => {
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(400)
      // Switch to the Vacancies tab — it has 4 seeded fields.
      await page.getByRole('tab', { name: 'Vacancies' }).click()
      await page.waitForTimeout(500)
      // Expand the "Tech requirements" group. The toggle is a <button>
      // wrapping the chevron + group name + badge.
      await page
        .getByRole('button', { name: /Tech requirements/ })
        .first()
        .click()
      await page.waitForTimeout(500)
    },
  },
  {
    name: 'custom-fields-vacancy-display',
    url: '/vacancies',
    output: 'public/guide/screenshots/custom-fields-vacancy-display.png',
    preActions: async (page) => {
      await page.waitForSelector('table a[href^="/vacancies/"]:not([href="/vacancies/new"])', {
        timeout: 15_000,
      })
      const href = await page.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll('table a[href^="/vacancies/"]')
        ) as HTMLAnchorElement[]
        const target = links.find((a) => (a.textContent || '').includes('Senior Software Engineer'))
        return target?.getAttribute('href') ?? null
      })
      if (!href) throw new Error('Could not find Senior Software Engineer row')
      const baseUrl =
        process.env.SCREENSHOT_BASE_URL ?? 'https://staging.hrhandle.com'
      await page.goto(`${baseUrl}${href}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(500)
      // Scroll the Additional Information section into view.
      await page.evaluate(() => {
        const headings = Array.from(
          document.querySelectorAll('h3, [class*="CardTitle"], div')
        ) as HTMLElement[]
        const target = headings.find((el) =>
          (el.textContent || '').trim().startsWith('Additional Information')
        )
        target?.scrollIntoView({ block: 'center' })
      })
      await page.waitForTimeout(400)
    },
  },

  // ---- assessments-and-questions ----
  {
    name: 'assessments-vacancy-qe-tab',
    url: '/vacancies',
    output: 'public/guide/screenshots/assessments-vacancy-qe-tab.png',
    preActions: async (page) => {
      await page.waitForSelector('table a[href^="/vacancies/"]:not([href="/vacancies/new"])', {
        timeout: 15_000,
      })
      const href = await page.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll('table a[href^="/vacancies/"]')
        ) as HTMLAnchorElement[]
        const target = links.find((a) => (a.textContent || '').includes('Senior Software Engineer'))
        return target?.getAttribute('href') ?? null
      })
      if (!href) throw new Error('Could not find Senior Software Engineer row')
      const baseUrl =
        process.env.SCREENSHOT_BASE_URL ?? 'https://staging.hrhandle.com'
      await page.goto(`${baseUrl}${href}?tab=qe`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
    },
  },
  {
    name: 'assessments-application-form',
    url: '/vacancies',
    output: 'public/guide/screenshots/assessments-application-form.png',
    preActions: async (page) => {
      await page.waitForSelector('table a[href^="/vacancies/"]:not([href="/vacancies/new"])', {
        timeout: 15_000,
      })
      const href = await page.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll('table a[href^="/vacancies/"]')
        ) as HTMLAnchorElement[]
        const target = links.find((a) => (a.textContent || '').includes('Senior Software Engineer'))
        return target?.getAttribute('href') ?? null
      })
      if (!href) throw new Error('Could not find Senior Software Engineer row')
      const baseUrl =
        process.env.SCREENSHOT_BASE_URL ?? 'https://staging.hrhandle.com'
      await page.goto(`${baseUrl}${href}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(500)
      // Expand the application row for Lukas Becker by clicking its chevron.
      await page.evaluate(() => {
        // Each row has a ChevronRight inside a button with title "Assessment & Questionary".
        // The candidate name lives in a sibling Link.
        const rows = Array.from(document.querySelectorAll('div')) as HTMLElement[]
        for (const row of rows) {
          if (row.querySelector('button[title*="Assessment"]') && /Lukas Becker/.test(row.textContent || '')) {
            const toggle = row.querySelector('button[title*="Assessment"]') as HTMLButtonElement | null
            toggle?.click()
            return
          }
        }
      })
      await page.waitForTimeout(700)
      // Scroll the expanded form into view.
      await page.evaluate(() => {
        const textarea = document.querySelector('textarea[placeholder*="Enter answer"]') as HTMLElement | null
        textarea?.scrollIntoView({ block: 'center' })
      })
      await page.waitForTimeout(300)
    },
  },

  // ---- pipeline-kanban ----
  {
    name: 'pipeline-kanban-overview',
    url: '/vacancies',
    output: 'public/guide/screenshots/pipeline-kanban-overview.png',
    preActions: async (page) => {
      // Find the Senior Software Engineer vacancy and navigate to its pipeline.
      await page.waitForSelector('table a[href^="/vacancies/"]:not([href="/vacancies/new"])', {
        timeout: 15_000,
      })
      const href = await page.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll('table a[href^="/vacancies/"]')
        ) as HTMLAnchorElement[]
        const target = links.find((a) => (a.textContent || '').includes('Senior Software Engineer'))
        return target?.getAttribute('href') ?? null
      })
      if (!href) throw new Error('Could not find Senior Software Engineer row')
      const baseUrl =
        process.env.SCREENSHOT_BASE_URL ?? 'https://staging.hrhandle.com'
      await page.goto(`${baseUrl}${href}/pipeline`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(800)
    },
  },
  // ---- manage-candidates ----
  {
    name: 'manage-candidates-list',
    url: '/candidates',
    output: 'public/guide/screenshots/manage-candidates-list.png',
    preActions: async (page) => {
      await page.waitForSelector('a[href="/candidates/new"]', { timeout: 15_000 })
    },
    annotations: [
      {
        targetSelector: 'a[href="/candidates/new"]',
        label: 'Add Candidate',
        position: 'bottom',
        style: 'arrow',
      },
    ],
  },
  {
    name: 'manage-candidates-entry-mode',
    url: '/candidates/new',
    output: 'public/guide/screenshots/manage-candidates-entry-mode.png',
    preActions: async (page) => {
      await page.waitForSelector('button:has-text("Upload CV first"), button >> text=Upload CV first', {
        timeout: 15_000,
      })
      await page.waitForTimeout(300)
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
        const cv = btns.find((b) => (b.textContent || '').includes('Upload CV first'))
        const manual = btns.find((b) => (b.textContent || '').includes('Fill manually'))
        if (cv) cv.setAttribute('data-shot', 'cv-path')
        if (manual) manual.setAttribute('data-shot', 'manual-path')
      })
    },
    annotations: [
      {
        targetSelector: '[data-shot="cv-path"]',
        label: 'Auto-fill from CV',
        position: 'bottom',
        style: 'box',
      },
      {
        targetSelector: '[data-shot="manual-path"]',
        label: 'Enter by hand',
        position: 'bottom',
        style: 'box',
      },
    ],
  },
  {
    name: 'manage-candidates-detail',
    url: '/candidates',
    output: 'public/guide/screenshots/manage-candidates-detail.png',
    preActions: async (page) => {
      // Read the Lukas Becker row's link href and navigate to it directly.
      await page.waitForSelector('table a[href^="/candidates/"]:not([href="/candidates/new"])', {
        timeout: 15_000,
      })
      const href = await page.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll('table a[href^="/candidates/"]')
        ) as HTMLAnchorElement[]
        const target = links.find((a) => (a.textContent || '').includes('Lukas Becker'))
        return target?.getAttribute('href') ?? null
      })
      if (!href) throw new Error('Could not find Lukas Becker row link')
      const baseUrl =
        process.env.SCREENSHOT_BASE_URL ?? 'https://staging.hrhandle.com'
      await page.goto(`${baseUrl}${href}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
    },
  },

  // ---- public-apply-link ----
  {
    name: 'public-apply-link-activate',
    url: '/vacancies',
    output: 'public/guide/screenshots/public-apply-link-activate.png',
    preActions: async (page) => {
      // Click the HR Coordinator vacancy (Draft, no apply token).
      await page.waitForSelector('table a[href^="/vacancies/"]:not([href="/vacancies/new"])', {
        timeout: 15_000,
      })
      const link = page.getByRole('link', { name: /HR Coordinator/ }).first()
      await link.click()
      await page.waitForLoadState('networkidle')
      await page.getByRole('tab', { name: 'Apply Link' }).click()
      await page.waitForTimeout(600)
      // Tag the Activate button.
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
        const activate = btns.find((b) => (b.textContent || '').includes('Activate Application Form'))
        if (activate) activate.setAttribute('data-shot', 'activate-btn')
      })
    },
    annotations: [
      {
        targetSelector: '[data-shot="activate-btn"]',
        label: 'Activate',
        position: 'right',
        style: 'arrow',
      },
    ],
  },
  {
    name: 'public-apply-link-active',
    url: '/vacancies',
    output: 'public/guide/screenshots/public-apply-link-active.png',
    preActions: async (page) => {
      // Click the Senior Software Engineer (Open, has active token).
      await page.waitForSelector('table a[href^="/vacancies/"]:not([href="/vacancies/new"])', {
        timeout: 15_000,
      })
      const link = page.getByRole('link', { name: /Senior Software Engineer/ }).first()
      await link.click()
      await page.waitForLoadState('networkidle')
      await page.getByRole('tab', { name: 'Apply Link' }).click()
      await page.waitForTimeout(600)
      // Tag the copy and open-in-new-tab controls inside the URL row.
      await page.evaluate(() => {
        const urlSpan = Array.from(document.querySelectorAll('span.font-mono')).find((el) =>
          (el.textContent || '').includes('/apply/')
        ) as HTMLElement | undefined
        const container = urlSpan?.closest('div') as HTMLElement | undefined
        if (!container) return
        const copyBtn = container.querySelector('button')
        if (copyBtn) copyBtn.setAttribute('data-shot', 'copy-btn')
        const openLink = container.querySelector('a[target="_blank"]')
        if (openLink) openLink.setAttribute('data-shot', 'open-btn')
      })
    },
    annotations: [
      {
        targetSelector: '[data-shot="copy-btn"]',
        label: 'Copy',
        position: 'top',
        style: 'arrow',
      },
      {
        targetSelector: '[data-shot="open-btn"]',
        label: 'Open',
        position: 'bottom',
        style: 'arrow',
      },
    ],
  },
  {
    name: 'public-apply-link-public-form',
    url: '/vacancies',
    output: 'public/guide/screenshots/public-apply-link-public-form.png',
    preActions: async (page) => {
      // Navigate via the dashboard so we always pick up the current token.
      await page.waitForSelector('table a[href^="/vacancies/"]:not([href="/vacancies/new"])', {
        timeout: 15_000,
      })
      const link = page.getByRole('link', { name: /Senior Software Engineer/ }).first()
      await link.click()
      await page.waitForLoadState('networkidle')
      await page.getByRole('tab', { name: 'Apply Link' }).click()
      await page.waitForTimeout(400)
      const applyUrl = await page.evaluate(() => {
        const urlSpan = Array.from(document.querySelectorAll('span.font-mono')).find((el) =>
          (el.textContent || '').includes('/apply/')
        ) as HTMLElement | undefined
        return urlSpan?.textContent?.trim() ?? null
      })
      if (!applyUrl) throw new Error('Could not read public apply URL from dashboard')
      await page.goto(applyUrl, { waitUntil: 'networkidle' })
      // Tag the CV upload button.
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
        const upload = btns.find((b) =>
          (b.textContent || '').includes('Upload PDF or Word document')
        )
        if (upload) upload.setAttribute('data-shot', 'cv-upload')
      })
    },
    annotations: [
      {
        targetSelector: '[data-shot="cv-upload"]',
        label: 'Upload CV first',
        position: 'right',
        style: 'arrow',
      },
    ],
  },
  {
    name: 'post-a-vacancy-apply-link',
    url: '/vacancies',
    output: 'public/guide/screenshots/post-a-vacancy-apply-link.png',
    preActions: async (page) => {
      // Open the Senior Software Engineer vacancy (Open status, has token).
      await page.waitForSelector('table a[href^="/vacancies/"]:not([href="/vacancies/new"])', {
        timeout: 15_000,
      })
      const link = page.getByRole('link', { name: /Senior Software Engineer/ }).first()
      await link.click()
      await page.waitForLoadState('networkidle')
      // Switch to Apply Link tab.
      await page.getByRole('tab', { name: 'Apply Link' }).click()
      // The Apply Link tab may need to render the URL input.
      await page.waitForTimeout(800)
      // Tag the public apply URL display. UI renders it inside a span with
      // font-mono. We tag the parent container so the box wraps the whole
      // URL row (URL text + copy/open icons).
      await page.evaluate(() => {
        const spans = Array.from(
          document.querySelectorAll('span.font-mono')
        ) as HTMLElement[]
        const urlSpan = spans.find((el) => (el.textContent || '').includes('/apply/'))
        const container = (urlSpan?.closest('div') as HTMLElement) ?? urlSpan ?? null
        if (container) container.setAttribute('data-shot', 'apply-url')
      })
    },
    annotations: [
      {
        targetSelector: '[data-shot="apply-url"]',
        label: 'Public apply URL',
        position: 'top',
        style: 'box',
      },
    ],
  },
]
