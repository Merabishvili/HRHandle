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
