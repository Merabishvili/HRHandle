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
    annotations: [
      {
        targetSelector: 'a[href="/vacancies/new"], button:has-text("New vacancy")',
        label: 'New vacancy',
        position: 'left',
        style: 'arrow',
      },
    ],
  },
  {
    name: 'post-a-vacancy-form',
    url: '/vacancies/new',
    output: 'public/guide/screenshots/post-a-vacancy-form.png',
    annotations: [
      {
        targetSelector: '[name="title"], input[id*="title"]',
        label: '1. Title',
        position: 'right',
        style: 'arrow',
      },
      {
        targetSelector: 'textarea[name="description"], textarea[id*="description"]',
        label: '2. Description',
        position: 'right',
        style: 'arrow',
      },
      {
        targetSelector: 'input[name="start_date"], input[id*="start"]',
        label: '3. Start date',
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
      // Click the first vacancy in the list, then switch to Apply Link tab.
      const firstRow = page.locator('a[href^="/vacancies/"]:not([href="/vacancies/new"])').first()
      await firstRow.click()
      await page.waitForLoadState('networkidle')
      const applyTab = page.locator('[role="tab"]:has-text("Apply Link")').first()
      await applyTab.click()
    },
    annotations: [
      {
        targetSelector: 'input[readonly][value*="/apply/"], code:has-text("/apply/")',
        label: 'Public apply URL',
        position: 'top',
        style: 'box',
      },
    ],
  },
]
