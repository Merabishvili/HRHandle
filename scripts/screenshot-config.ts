/**
 * Guide screenshot flows — one per topic, run once per language by
 * `scripts/capture-screenshots.ts`.
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

export interface Mark {
  target: Locator
  /** Number badge, referenced from the guide text. */
  n?: number
  /** Badge on the box's top-left corner (default; fine for padded cards and
   * buttons) or outside its left edge (form fields, so the label stays readable). */
  badge?: 'corner' | 'left'
  pad?: number
}

export interface ShotOptions {
  marks?: Mark[]
  /** Capture only this element (plus `clipPad`) instead of the window. */
  clip?: Locator
  clipPad?: number
  /** Capture the whole page height (the window grows to fit it). */
  fullPage?: boolean
}

export interface ShotContext {
  page: Page
  locale: Locale
  demo: DemoOrg
  /** Service-role client for setup and cleanup (staging only). */
  admin: SupabaseClient
  /** The app's translation for this language. */
  t: (key: string, values?: Record<string, string | number>) => string
  goto: (path: string) => Promise<void>
  shot: (name: string, opts?: ShotOptions) => Promise<void>
}

export interface Flow {
  /** Guide slug the shots belong to (`--topic` filter). */
  topic: string
  run: (ctx: ShotContext) => Promise<void>
  /** Undo anything the flow created, even after a failure. */
  cleanup?: (ctx: ShotContext) => Promise<void>
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Pick an option in a Radix <Select> by its visible (translated) label. */
async function pickSelect(page: Page, trigger: string, option: string): Promise<void> {
  await page.locator(trigger).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** Pick an option in a SearchableSelect (combobox + search list). */
async function pickSearchable(page: Page, trigger: string, option: string): Promise<void> {
  await page.locator(trigger).click()
  await page.getByRole('option', { name: option }).first().click()
}

/** Pick a day in the DatePicker popover, paging months forward as needed. */
async function pickDate(page: Page, trigger: Locator, isoDay: string): Promise<void> {
  await trigger.click()
  // Scope to the calendar that just opened (a closed one can linger while it animates out).
  const calendar = page.locator('[data-radix-popper-content-wrapper]').last()
  const day = calendar.locator(`td[data-day="${isoDay}"] button`)
  for (let i = 0; i < 12 && !(await day.isVisible()); i++) {
    await calendar.locator('.rdp-button_next').click()
  }
  await day.click()
  await calendar.waitFor({ state: 'detached' }).catch(() => page.keyboard.press('Escape'))
}

const isoInDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

/** The wizard footer's primary "Next: …" button. */
const wizardNext = (ctx: ShotContext, nextStepKey: string) =>
  ctx.page.getByRole('button', { name: ctx.t('wizard.next', { label: ctx.t(nextStepKey) }) })

/** Delete a demo vacancy created by a flow, with everything hanging off it. */
async function deleteVacancyByTitle(ctx: ShotContext, title: string): Promise<void> {
  const { data: profile } = await ctx.admin
    .from('profiles')
    .select('organization_id')
    .eq('email', ctx.demo.users.find((u) => u.role === 'owner')!.email)
    .single()
  if (!profile?.organization_id) return
  const { data: rows } = await ctx.admin
    .from('vacancies')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .eq('title', title)
  for (const { id } of rows ?? []) {
    await ctx.admin.from('custom_field_values').delete().eq('entity_id', id)
    await ctx.admin.from('activity_log').delete().eq('entity_id', id)
    await ctx.admin.from('vacancies').delete().eq('id', id)
  }
}

// ── Flows ────────────────────────────────────────────────────────────────

const createVacancy: Flow = {
  topic: 'post-a-vacancy',
  async run(ctx) {
    const { page, t, demo } = ctx
    const w = demo.wizard
    await deleteVacancyByTitle(ctx, w.title) // leftovers from an interrupted run

    // 1 — The Vacancies list and its Create vacancy button.
    await ctx.goto('/vacancies')
    const create = page.getByRole('link', { name: t('wizard.createVacancy') }).first()
    await create.waitFor()
    await ctx.shot('vacancies-list', { marks: [{ target: create, n: 1 }] })

    // 2 — Step 1, Basics.
    await create.click()
    await page.locator('#title').waitFor()
    await page.fill('#title', w.title)
    await page.fill('#department', w.department)
    await pickSelect(page, '#sector', t('sector.it'))
    await page.fill('#location', w.location)
    await pickSelect(page, '#work_mode', t('enum.workMode.hybrid'))
    await page.fill('#openings', '2')
    await pickSearchable(page, '#hiring_manager', demo.users.find((u) => u.key === 'admin')!.fullName)
    const rail = page.getByRole('complementary', { name: t('wizard.stepsAria') })
    await ctx.shot('create-vacancy-basics', {
      marks: [
        { target: rail, n: 1 },
        { target: page.locator('#title').locator('xpath=..'), n: 2, badge: 'left' },
        { target: wizardNext(ctx, 'wizard.stepDates'), n: 3 },
      ],
    })

    // 3 — Step 2, Dates & compensation (+ the org's custom fields).
    await wizardNext(ctx, 'wizard.stepDates').click()
    await page.locator('#salary_min').waitFor()
    await pickDate(page, page.locator('button').filter({ hasText: t('common.dateFormat') }).first(), isoInDays(0))
    await pickDate(page, page.locator('button').filter({ hasText: t('common.dateFormat') }).first(), isoInDays(30))
    await page.fill('#salary_min', '3500')
    await page.fill('#salary_max', '5000')
    // The org's custom fields: a dropdown and a yes/no field.
    const [priority, budget] = demo.vacancyFields.fields
    await page.getByLabel(priority!.name).click()
    await page.getByRole('option', { name: priority!.options![0]!, exact: true }).click()
    await page.getByLabel(budget!.name).click()
    await page.getByRole('option', { name: t('common.yes'), exact: true }).click()
    const gridOf = (l: Locator) => l.locator('xpath=ancestor::div[contains(@class,"grid")][1]')
    await ctx.shot('create-vacancy-dates', {
      marks: [
        { target: gridOf(page.locator('label[for="start_date"]')), n: 1, badge: 'left' },
        { target: gridOf(page.locator('#salary_min')), n: 2, badge: 'left' },
        // innermost <section> — the wizard's own panel is a <section> too
        { target: page.locator('section').filter({ has: page.getByRole('heading', { name: demo.vacancyFields.group }) }).last(), n: 3, badge: 'left' },
      ],
    })

    // 4 — Step 3, Description & AI: let the AI draft every section.
    await wizardNext(ctx, 'wizard.stepDescription').click()
    await page.locator('#description').waitFor()
    await page.getByRole('button', { name: t('aiJd.headerTitle') }).click()
    await page.fill('#ai-jd-context', w.aiContext)
    const panel = page.locator('#ai-jd-context').locator('xpath=ancestor::div[contains(@class,"border-dashed")][1]')
    for (let section = 0; section < 3; section++) {
      // Retry a failed AI call (network hiccups happen); give up after 3 tries.
      for (let attempt = 1; ; attempt++) {
        await panel.getByRole('button', { name: t('aiJd.generate'), exact: true }).first().click()
        const done = panel.getByRole('button', { name: t('aiJd.regenerate') }).nth(section)
        const failed = panel.getByText(t('aiJd.failed'))
        await done.or(failed).first().waitFor({ timeout: 90_000 })
        if (await done.isVisible()) break
        if (attempt === 3) throw new Error('the AI writer failed 3 times')
        await page.waitForTimeout(3_000)
      }
    }
    const applyAll = panel.getByRole('button', { name: t('aiJd.applyAll') })
    await ctx.shot('create-vacancy-ai', {
      clip: panel,
      marks: [
        { target: page.locator('#ai-jd-context'), n: 1, badge: 'left' },
        { target: panel.getByRole('button', { name: t('aiJd.regenerate') }).first(), n: 2 },
        { target: applyAll, n: 3 },
      ],
    })
    await applyAll.click()
    await page.getByRole('button', { name: t('aiJd.headerTitle') }).click() // collapse the panel again
    const publicSwitch = page.getByRole('switch', { name: t('vacancy.form.showOnPublic') })
    await publicSwitch.click()
    await ctx.shot('create-vacancy-description', {
      fullPage: true,
      marks: [
        { target: page.getByRole('button', { name: t('aiJd.headerTitle') }), n: 1, badge: 'left' },
        { target: page.getByRole('button', { name: t('aiBias.headerTitle') }), n: 2, badge: 'left' },
        { target: publicSwitch.locator('xpath=..'), n: 3, badge: 'left' },
      ],
    })

    // 5 — Step 4, Scorecard & questions.
    await wizardNext(ctx, 'wizard.stepScorecard').click()
    const attrInput = page.getByRole('textbox', { name: t('wizard.newAttributeAria') })
    await attrInput.waitFor()
    for (const a of w.scorecard) {
      await attrInput.fill(a.label)
      await attrInput.press('Enter')
      if (a.mustHave) {
        await page
          .getByRole('listitem')
          .filter({ hasText: a.label })
          .getByRole('button', { name: t('wizard.markMustHave') })
          .click()
      }
    }
    const questionInput = page.getByRole('textbox', { name: t('wizard.newQuestionAria') })
    const screening = page.getByRole('region', { name: t('wizard.screeningQuestions') })
    await questionInput.fill(w.screening.yesNo)
    await screening.getByRole('button', { name: t('wizard.add'), exact: true }).click()
    await questionInput.fill(w.screening.number)
    await screening.getByRole('radio', { name: t('wizard.typeNumber') }).click()
    await screening.getByRole('button', { name: t('wizard.add'), exact: true }).click()
    const yesNoRow = screening.getByRole('listitem').filter({ hasText: w.screening.yesNo })
    await yesNoRow.getByRole('button', { name: t('wizard.knockout'), exact: true }).click()
    const numberRow = screening.getByRole('listitem').filter({ hasText: w.screening.number })
    await numberRow.getByRole('button', { name: t('wizard.knockout'), exact: true }).click()
    await numberRow.getByRole('combobox', { name: t('wizard.comparison') }).selectOption('gte')
    await numberRow.getByRole('spinbutton', { name: t('wizard.knockoutValueAria') }).fill('2')
    await ctx.shot('create-vacancy-scorecard', {
      fullPage: true,
      marks: [
        { target: page.getByRole('region', { name: t('wizard.interviewScorecard') }), n: 1 },
        { target: screening, n: 2 },
      ],
    })

    // 6 — Step 5, Review & publish.
    await wizardNext(ctx, 'wizard.stepReview').click()
    const publish = page.getByRole('button', { name: t('wizard.publishNow'), exact: true }).last()
    await publish.waitFor()
    await ctx.shot('create-vacancy-review', {
      fullPage: true,
      marks: [
        { target: page.getByText(t('wizard.howFinish')).locator('xpath=..'), n: 1 },
        { target: publish, n: 2 },
      ],
    })

    // 7 — Publish and land on the new vacancy.
    await publish.click()
    await page.waitForURL(/\/vacancies\/[0-9a-f-]{36}/, { timeout: 30_000 })
    await page.waitForLoadState('networkidle')
    await ctx.shot('create-vacancy-done', {
      marks: [
        { target: page.getByRole('button', { name: t('copyLink.button') }), n: 1 },
        // first = the header button (Russian uses the same label further down)
        { target: page.getByRole('link', { name: t('vacHeader.viewPipeline') }).first(), n: 2 },
        { target: page.getByRole('tablist'), n: 3, badge: 'left' },
      ],
    })
  },
  async cleanup(ctx) {
    await deleteVacancyByTitle(ctx, ctx.demo.wizard.title)
  },
}

export const FLOWS: Flow[] = [createVacancy]
