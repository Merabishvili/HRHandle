/**
 * Guide flows for the "Vacancies" section: create a vacancy (the wizard),
 * the vacancy page, sharing a vacancy.
 */
import type { Locator } from 'playwright'
import type { Flow, ShotContext } from '../screenshot-config'
import { deleteVacancyByTitle, escapeRegExp, isoInDays, pickDate, pickSearchable, pickSelect, settle, vacancyId } from './helpers'

/** The wizard footer's primary "Next: …" button. */
const wizardNext = (ctx: ShotContext, nextStepKey: string) =>
  ctx.page.getByRole('button', { name: ctx.t('wizard.next', { label: ctx.t(nextStepKey) }) })

export const createVacancy: Flow = {
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

/** A section of the vacancy page by its accessible name (every card is a labelled <section>). */
const region = (ctx: ShotContext, key: string) => ctx.page.getByRole('region', { name: ctx.t(key), exact: true })

/** Open one of the vacancy page's tabs. */
async function openTab(ctx: ShotContext, key: string): Promise<void> {
  await ctx.page.getByRole('tab', { name: ctx.t(key) }).click()
  await settle(ctx.page, 500)
}

const vacancyPage: Flow = {
  topic: 'vacancy-page',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto(`/vacancies/${await vacancyId(ctx, 'engineer')}`)
    const copyLink = page.getByRole('button', { name: t('copyLink.button') })
    await copyLink.waitFor()

    // Overview: header actions, tabs, what needs attention, the pipeline summary, at a glance.
    await ctx.shot('vacancy-overview', {
      fullPage: true,
      marks: [
        { target: copyLink.locator('xpath=..'), n: 1, badge: 'below' },
        { target: page.getByRole('tablist'), n: 2, badge: 'left' },
        { target: region(ctx, 'vacOverview.needsAttentionAria'), n: 3, badge: 'left' },
        { target: region(ctx, 'vacOverview.pipeline'), n: 4, badge: 'left' },
        { target: region(ctx, 'vacOverview.atAGlance'), n: 5 },
      ],
    })

    // The ⋯ menu: edit, duplicate, delete.
    await page.getByRole('button', { name: t('profile.moreActions') }).click()
    const menu = page.getByRole('menu')
    await menu.waitFor()
    await ctx.shot('vacancy-actions-menu', { clip: menu, clipPad: 20 })
    await page.keyboard.press('Escape')

    await openTab(ctx, 'vacTabs.jd')
    await ctx.shot('vacancy-jd', {
      fullPage: true,
      marks: [
        { target: page.getByRole('link', { name: t('jdTab.improveWithAi') }).locator('xpath=..'), n: 1, badge: 'below' },
        { target: region(ctx, 'jdTab.postingDetails'), n: 2 },
        { target: region(ctx, 'jdTab.previewApplyPage'), n: 3 },
      ],
    })

    await openTab(ctx, 'vacTabs.scorecard')
    await ctx.shot('vacancy-scorecard', {
      fullPage: true,
      marks: [
        { target: page.getByRole('region', { name: t('scoreModal.scorecard'), exact: true }), n: 1 },
        { target: page.getByRole('region', { name: t('scoreModal.interviewGuide'), exact: true }), n: 2 },
      ],
    })

    await openTab(ctx, 'vacTabs.settings')
    await ctx.shot('vacancy-settings', {
      fullPage: true,
      marks: [
        { target: region(ctx, 'vacSettings.vacancyDetails'), n: 1, badge: 'left' },
        { target: region(ctx, 'vacSettings.statusVisibility'), n: 2, badge: 'left' },
        { target: region(ctx, 'vacSettings.pipelineStages'), n: 3, badge: 'left' },
        { target: region(ctx, 'vacSettings.dangerZone'), n: 4, badge: 'left' },
      ],
    })

    // Closing a vacancy that still has candidates in progress asks what to do
    // with them. Looked at, then cancelled — the demo vacancy stays open.
    await region(ctx, 'vacSettings.statusVisibility').getByRole('button', { name: t('vacStatus.open') }).click()
    await page.getByRole('menuitem', { name: t('vacStatus.closed') }).click()
    const closeDialog = page.getByRole('dialog')
    const closeOnly = closeDialog.getByRole('button', { name: t('closeVacancy.closeOnly') })
    await closeOnly.waitFor()
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await settle(page, 300)
    await ctx.shot('vacancy-close', {
      clip: closeDialog,
      clipPad: 32,
      marks: [
        { target: closeDialog.getByRole('group'), n: 1, badge: 'left' },
        { target: closeOnly, n: 2, badge: 'below' },
        { target: closeDialog.getByRole('button', { name: t('closeVacancy.closeAndReject') }), n: 3, badge: 'below' },
      ],
    })
    await closeDialog.getByRole('button', { name: t('common.cancel') }).click()
    await closeDialog.waitFor({ state: 'detached' })
  },
}

const shareVacancy: Flow = {
  topic: 'share-a-vacancy',
  async run(ctx) {
    const { page, t } = ctx
    const engineerId = await vacancyId(ctx, 'engineer')

    // The Apply form tab: screening questions and the apply link.
    await ctx.goto(`/vacancies/${engineerId}`)
    await openTab(ctx, 'vacTabs.applicationForm')
    const linkCard = page.getByText(t('applyForm.applyLink'), { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
    await ctx.shot('share-apply-link', {
      fullPage: true,
      marks: [
        { target: linkCard, n: 1, badge: 'left' },
        { target: page.getByRole('button', { name: t('applyForm.deactivate') }), n: 2 },
      ],
    })

    // LinkedIn Jobs (the demo orgs have their company page connected): the Share box…
    await openTab(ctx, 'vacTabs.overview')
    const shareBox = region(ctx, 'vacOverview.share')
    const postButton = shareBox.getByRole('button', { name: t('liPost.postToLinkedIn') })
    await postButton.waitFor()
    await ctx.shot('share-linkedin', { clip: shareBox, clipPad: 40, marks: [{ target: postButton, n: 1, badge: 'left' }] })

    // …and the window with the parts to paste into LinkedIn's job form.
    await postButton.click()
    const dialog = page.getByRole('dialog')
    const openPosting = dialog.getByRole('link', { name: t('liPost.openPosting') })
    await openPosting.waitFor()
    // The title field opens focused with its text selected; drop the focus for the picture.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await settle(page, 300)
    const step = (key: string) => dialog.getByText(t(key), { exact: true }).locator('xpath=..')
    await ctx.shot('share-linkedin-dialog', {
      clip: dialog,
      clipPad: 32,
      marks: [
        {
          target: dialog.locator('div.space-y-1\\.5').filter({
            has: page.getByText(new RegExp(`^(${escapeRegExp(t('liPost.step1'))}|${escapeRegExp(t('liPost.step2'))})$`)),
          }),
          n: 1,
          badge: 'left',
          union: true,
        },
        { target: step('liPost.step3'), n: 2, badge: 'left' },
        { target: openPosting, n: 3, badge: 'left' },
      ],
    })
    await page.keyboard.press('Escape')

    // Where the jobs page link lives: the Vacancies list.
    await ctx.goto('/vacancies')
    const banner = page.getByText(t('vacancies.publicJobsPage'), { exact: true }).locator('xpath=..')
    await banner.waitFor()
    await ctx.shot('share-jobs-page-link', { marks: [{ target: banner, n: 1, badge: 'left' }] })

    // What job seekers see (signed out): the jobs page and a vacancy's apply page.
    const { data: org } = await ctx.admin.from('organizations').select('public_page_slug').eq('id', ctx.orgId).single()
    const { data: vac } = await ctx.admin.from('vacancies').select('application_form_token').eq('id', engineerId).single()
    const guest = await ctx.openPage()
    await ctx.goto(`/jobs/${org!.public_page_slug}`, guest)
    await ctx.shot('share-jobs-page', { page: guest, fullPage: true })
    await ctx.goto(`/apply/${vac!.application_form_token}`, guest)
    await ctx.shot('share-apply-page', { page: guest })
  },
}

export const VACANCY_FLOWS: Flow[] = [createVacancy, vacancyPage, shareVacancy]
