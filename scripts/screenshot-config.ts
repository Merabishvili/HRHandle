/**
 * Guide screenshot flows — one per topic, run once per language by
 * `scripts/capture-screenshots.ts`. The flows live in scripts/guide-flows/
 * (one file per guide section, shared helpers in helpers.ts); this file holds
 * their types and the list the capture script runs.
 *
 * A flow drives the real UI like a user would and calls `shot()` along the way,
 * so a multi-step walkthrough (the vacancy wizard) keeps its state between
 * shots. Find elements by id or role and by the app's own translated labels
 * (`t('wizard.createVacancy')`), never by English text, so the same flow works
 * in every language. Type sample data from `demo` (the language's demo company).
 *
 * Markers are numbered red boxes; the guide text explains each number, so
 * nothing on the image needs translating.
 */
import type { Locator, Page } from 'playwright'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Locale } from '@/lib/i18n/locales'
import type { DemoOrg } from './guide-demo-data'
import { GETTING_STARTED_FLOWS } from './guide-flows/getting-started'
import { VACANCY_FLOWS } from './guide-flows/vacancies'
import { CANDIDATE_FLOWS } from './guide-flows/candidates'
import { HIRING_FLOWS } from './guide-flows/hiring'
import { COMMUNICATION_FLOWS } from './guide-flows/communication'
import { AI_AND_REPORTS_FLOWS } from './guide-flows/ai-and-reports'
import { ADMINISTRATION_FLOWS } from './guide-flows/administration'

export interface Mark {
  target: Locator
  /** Number badge, referenced from the guide text. */
  n?: number
  /** Badge on the box's top-left corner (default; fine for padded cards and
   * buttons), outside its left edge (form fields, so the label stays readable),
   * outside its right edge, or below it (small controls side by side, like the
   * header icons). */
  badge?: 'corner' | 'left' | 'right' | 'below'
  /** One box around every element `target` matches (e.g. all the sidebar links). */
  union?: boolean
  pad?: number
}

export interface ShotOptions {
  marks?: Mark[]
  /** Capture only this element (plus `clipPad`) instead of the window. */
  clip?: Locator
  clipPad?: number
  /** Capture the whole page height (the window grows to fit it). */
  fullPage?: boolean
  /** Make the window this tall instead (e.g. so a side sheet fits without scrolling). */
  windowHeight?: number
  /** Capture this page instead of the signed-in owner's (see `openPage`). */
  page?: Page
}

export interface ShotContext {
  /** Signed in as this language's demo owner, interface in this language. */
  page: Page
  locale: Locale
  demo: DemoOrg
  /** The demo owner's organization. */
  orgId: string
  /** Service-role client for setup and cleanup (staging only). */
  admin: SupabaseClient
  /** The app's translation for this language. */
  t: (key: string, values?: Record<string, string | number>) => string
  /** Navigate the owner's page (or `page`) to an app path and wait for it to settle. */
  goto: (path: string, page?: Page) => Promise<void>
  shot: (name: string, opts?: ShotOptions) => Promise<void>
  /** A page in a fresh browser (same language): signed out (`email: null`, the
   * default) or signed in as `email`. Closed after the flow. */
  openPage: (opts?: { email?: string | null }) => Promise<Page>
}

export interface Flow {
  /** Guide slug the shots belong to (`--topic` filter). */
  topic: string
  run: (ctx: ShotContext) => Promise<void>
  /** Undo anything the flow created, even after a failure. */
  cleanup?: (ctx: ShotContext) => Promise<void>
}

export const FLOWS: Flow[] = [...GETTING_STARTED_FLOWS, ...VACANCY_FLOWS, ...CANDIDATE_FLOWS, ...HIRING_FLOWS, ...COMMUNICATION_FLOWS, ...AI_AND_REPORTS_FLOWS, ...ADMINISTRATION_FLOWS]
