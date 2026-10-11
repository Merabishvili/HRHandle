/**
 * Guide flows for the "Hiring" section: the pipeline, assessments and
 * scorecards, rejecting candidates, interviews and offers. Nothing here is
 * saved — dialogs and forms are filled for the picture and then cancelled.
 */
import type { Locator } from 'playwright'
import type { Flow, ShotContext } from '../screenshot-config'
import { candidateId, candidateName, escapeRegExp, isoInDays, pickDate, pickSearchable, settle, userName, vacancyTitle } from './helpers'

const startsWith = (s: string) => new RegExp(`^${escapeRegExp(s)}`)

/** A pipeline card's select checkbox, by the candidate's name. */
const cardCheckbox = (ctx: ShotContext, key: string) =>
  ctx.page.getByRole('checkbox', { name: ctx.t('pipeline.selectNamed', { name: candidateName(ctx, key) }) })

/** The whole pipeline card. */
const pipelineCard = (ctx: ShotContext, key: string) =>
  cardCheckbox(ctx, key).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')

/** A button in the visible copy of the profile's side panel (it renders twice). */
const railButton = (ctx: ShotContext, key: string) =>
  ctx.page.getByRole('button', { name: ctx.t(key) }).filter({ visible: true }).first()

/** The profile card (an <article>) holding this element — the closest one; the profile itself is an article too. */
const cardOf = (l: Locator) => l.locator('xpath=ancestor::article[1]')

// ── The pipeline ────────────────────────────────────────────────────────────

const pipeline: Flow = {
  topic: 'pipeline',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/pipeline')
    const roles = page.getByRole('group', { name: t('pipeline.filter.groupAria') })
    await roles.waitFor()
    await settle(page, 600)
    const viewMode = page.getByRole('group', { name: t('pipeline.viewMode') })
    await ctx.shot('pipeline-board', {
      marks: [
        { target: roles, n: 1, badge: 'left' },
        { target: viewMode, n: 2, badge: 'below' },
        { target: page.getByRole('button', { name: t('pipeline.enterReviewMode') }), n: 3, badge: 'below' },
        { target: pipelineCard(ctx, 'c1'), n: 4 },
      ],
    })

    // The closed outcomes (rejected, withdrawn) fold out at the end of the board.
    await page.getByRole('button', { name: startsWith(t('pipeline.showClosed', { summary: '' }).trim()) }).click()
    const closed = page.getByRole('button', { name: t('pipeline.collapseClosed') }).locator('xpath=ancestor::div[contains(@class,"shrink-0")][1]')
    await closed.scrollIntoViewIfNeeded()
    await settle(page, 300)
    await ctx.shot('pipeline-closed', { clip: closed, clipPad: 24 })
    await page.getByRole('button', { name: t('pipeline.collapseClosed') }).click()

    // Select two cards → the bulk-action bar.
    await cardCheckbox(ctx, 'c3').click()
    await cardCheckbox(ctx, 'c5').click()
    const bulk = page.getByRole('region', { name: t('pipeline.bulk.regionAria') })
    await bulk.waitFor()
    await ctx.shot('pipeline-bulk', {
      marks: [
        { target: pipelineCard(ctx, 'c3'), n: 1 },
        { target: pipelineCard(ctx, 'c5'), n: 1 },
        { target: bulk.locator('div.rounded-xl').first(), n: 2 },
      ],
    })
    await page.getByRole('button', { name: t('pipeline.bulk.clearSelection') }).click()

    // The list view (then back to the board — the choice is remembered).
    await viewMode.getByRole('button', { name: t('pipeline.list') }).click()
    await settle(page, 500)
    await ctx.shot('pipeline-list')
    await viewMode.getByRole('button', { name: t('pipeline.board') }).click()

    // Review mode for one role's new applicants; the second has a flagged screening answer.
    await roles.getByRole('button', { name: startsWith(vacancyTitle(ctx, 'engineer')) }).click()
    await settle(page, 400)
    await page.getByRole('button', { name: t('pipeline.enterReviewMode') }).click()
    const review = page.getByRole('dialog', { name: t('review.reviewModeAria') })
    await review.waitFor()
    await page.keyboard.press('ArrowRight')
    await review.getByText(candidateName(ctx, 'c5')).first().waitFor()
    // the CV and the screening answers load after the card
    await review.getByRole('button', { name: /CV_/ }).waitFor()
    await review.getByText(ctx.demo.engineerScreening[1]!.label).waitFor()
    await settle(page, 500)
    await ctx.shot('pipeline-review', {
      marks: [
        { target: review.locator('div.flex-shrink-0 > button'), n: 1, union: true },
        { target: review.getByRole('link', { name: t('review.openFullProfile') }), n: 2, badge: 'left' },
        { target: review.getByText(t('review.shortcuts')), n: 3, badge: 'below' },
      ],
    })
    await page.keyboard.press('Escape')

    // Settings → Main pipeline.
    await ctx.goto('/settings/pipeline-stages')
    const addStage = page.getByRole('button', { name: t('pipelineStages.addStage') }).last()
    await addStage.waitFor()
    await ctx.shot('pipeline-main-settings', {
      fullPage: true,
      marks: [
        { target: page.locator('ul.space-y-2').first(), n: 1, badge: 'left' },
        { target: addStage, n: 2, badge: 'below' },
      ],
    })
  },
}

// ── Assessments and scorecards ──────────────────────────────────────────────

const assessments: Flow = {
  topic: 'assessments-and-scorecards',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto(`/candidates/${await candidateId(ctx, 'c1')}`)
    const edit = page.getByRole('button', { name: t('stageBlock.editScorecard') })
    await edit.waitFor()
    await settle(page, 600)

    // The stage card's scorecard button.
    await ctx.shot('assessment-open', {
      clip: cardOf(edit),
      clipPad: 32,
      marks: [{ target: edit, n: 1 }],
    })

    // The assessment sheet, tall enough to show every section at once.
    await edit.click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: t('assess.submit') }).waitFor()
    await sheet.getByText(t('assess.sectionConclusion')).waitFor()
    await settle(page, 600)
    const height = await sheet.evaluate((el) => {
      const scroller = el.querySelector('.overflow-y-auto')
      return el.clientHeight + (scroller ? scroller.scrollHeight - scroller.clientHeight : 0)
    })
    const section = (key: string) =>
      sheet.locator('section').filter({ has: page.getByRole('heading', { name: t(key), exact: true }) })
    await ctx.shot('assessment-sheet', {
      windowHeight: height + 8,
      clip: sheet,
      clipPad: 36,
      marks: [
        { target: section('assess.sectionQuestions'), n: 1, badge: 'left' },
        { target: section('assess.sectionScorecard'), n: 2, badge: 'left' },
        { target: section('assess.sectionConclusion'), n: 3, badge: 'left' },
        { target: sheet.getByRole('button', { name: t('assess.submit') }).locator('xpath=..'), n: 4, badge: 'left' },
      ],
    })
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'detached' })

    // The permanent record on the profile, one card opened.
    const record = page.locator('#assessment-record')
    await record.scrollIntoViewIfNeeded()
    await record.getByRole('button').first().click()
    await settle(page, 400)
    await ctx.shot('assessment-record', {
      clip: record,
      clipPad: 24,
      marks: [{ target: record.getByRole('button').first(), n: 1, badge: 'left' }],
    })

    // Sharing that assessment: the Share button, the link window and the shared page.
    const share = record.getByRole('button', { name: t('assess.share'), exact: true }).first()
    await share.scrollIntoViewIfNeeded()
    await ctx.shot('assessment-share', { clip: record, clipPad: 24, marks: [{ target: share, n: 1, badge: 'left' }] })
    await share.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: t('shareScorecard.generateLink') }).click()
    const url = dialog.locator('#scorecard-share-url')
    await url.waitFor()
    // Wait for the save to finish (the buttons stay disabled until then).
    await dialog.getByRole('button', { name: t('shareScorecard.revokeLink') }).click({ trial: true })
    await settle(page, 300)
    await ctx.shot('assessment-share-dialog', {
      clip: dialog,
      clipPad: 32,
      marks: [
        { target: url.locator('xpath=ancestor::div[contains(@class,"space-y-1.5")][1]'), n: 1, badge: 'left' },
        { target: dialog.getByRole('button', { name: t('shareScorecard.revokeLink') }), n: 2, badge: 'left' },
      ],
    })
    const sharedPath = new URL(await url.inputValue()).pathname
    await page.keyboard.press('Escape')
    const guest = await ctx.openPage()
    await ctx.goto(sharedPath, guest)
    await ctx.shot('assessment-shared-page', { page: guest, fullPage: true })
  },
  // The walkthrough shares one assessment; take the link back so every run starts unshared.
  async cleanup(ctx) {
    await ctx.admin
      .from('candidate_evaluations')
      .update({ scorecard_token: null, scorecard_revoked_at: null, shared_by: null, shared_at: null })
      .eq('organization_id', ctx.orgId)
      .not('scorecard_token', 'is', null)
  },
}

// ── Rejecting candidates ────────────────────────────────────────────────────

const reject: Flow = {
  topic: 'reject-candidates',
  async run(ctx) {
    const { page, t } = ctx
    // One candidate, from the profile.
    await ctx.goto(`/candidates/${await candidateId(ctx, 'c2')}`)
    const rejectButton = railButton(ctx, 'rail.reject')
    await rejectButton.waitFor()
    await rejectButton.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByText(t('rejectDialog.title')).waitFor()
    await dialog.getByText(t('rejectDialog.reason'), { exact: true }).locator('xpath=..').getByRole('combobox').click()
    await page.getByRole('option', { name: ctx.demo.rejectionReasons[0]!.name }).first().click()
    await dialog.locator('#send-email-toggle').click()
    await dialog.getByText(t('rejectDialog.emailTemplate')).waitFor()
    await settle(page, 300)
    const field = (key: string) => dialog.getByText(t(key), { exact: true }).locator('xpath=..')
    await ctx.shot('reject-dialog', {
      clip: dialog,
      clipPad: 24,
      marks: [
        { target: field('rejectDialog.reason'), n: 1, badge: 'left' },
        { target: dialog.locator('#send-email-toggle').locator('xpath=..'), n: 2, badge: 'left' },
        { target: field('rejectDialog.emailTemplate'), n: 3, badge: 'left' },
        { target: dialog.getByRole('button', { name: t('rejectDialog.confirm') }), n: 4 },
      ],
    })
    await dialog.getByRole('button', { name: t('common.cancel') }).click()

    // Several at once, from the pipeline's bulk bar.
    await ctx.goto('/pipeline')
    await cardCheckbox(ctx, 'c3').click()
    await cardCheckbox(ctx, 'c5').click()
    await page.getByRole('region', { name: t('pipeline.bulk.regionAria') }).getByRole('button', { name: t('pipeline.bulk.reject') }).click()
    const batch = page.getByRole('dialog')
    await batch.getByRole('button', { name: t('batchReject.confirm', { count: 2 }) }).waitFor()
    await settle(page, 300)
    await ctx.shot('reject-batch', { clip: batch, clipPad: 24 })
    await batch.getByRole('button', { name: t('common.cancel') }).click()

    // Settings → Rejection reasons.
    await ctx.goto('/settings/rejection-reasons')
    const add = page.getByPlaceholder(t('rejectReasons.placeholder'))
    await add.waitFor()
    await ctx.shot('rejection-reasons', {
      fullPage: true,
      marks: [
        { target: page.getByText(t('rejectReasons.templateConfigured')).first().locator('xpath=ancestor::div[contains(@class,"border")][1]'), n: 1, badge: 'left' },
        { target: add.locator('xpath=..'), n: 2, badge: 'left' },
      ],
    })
  },
}

// ── Interviews ──────────────────────────────────────────────────────────────

const interviews: Flow = {
  topic: 'schedule-interview',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/interviews')
    const schedule = page.getByRole('link', { name: t('interviews.scheduleInterview') }).first()
    await schedule.waitFor()
    // The first row with a Join link (CSS, not role: an open menu hides the page from role queries).
    const upcoming = page.locator('div.rounded-lg.border').filter({ has: page.locator('a[target="_blank"]') }).first()
    await ctx.shot('interviews-list', {
      fullPage: true,
      marks: [
        { target: schedule, n: 1, badge: 'below' },
        { target: page.getByRole('button', { name: t('candidates.allTab'), exact: true }).first().locator('xpath=..'), n: 2, badge: 'left' },
        { target: upcoming, n: 3, badge: 'left' },
      ],
    })

    // The ⋯ menu on an upcoming interview.
    await upcoming.getByRole('button', { name: t('interviews.actionsAria') }).click()
    const menu = page.getByRole('menu')
    await menu.waitFor()
    await ctx.shot('interview-actions', { clip: menu, clipPad: 90 })
    await page.keyboard.press('Escape')

    // The scheduling form, filled in for a candidate in screening (not submitted).
    await ctx.goto(`/interviews/new?candidate=${await candidateId(ctx, 'c2')}`)
    await page.locator('#time').waitFor()
    await page.getByRole('radio', { name: startsWith(t('interviews.form.typeVideo')) }).click()
    const when = page.locator('#time').locator('xpath=ancestor::div[contains(@class,"grid")][1]')
    await pickDate(page, when.getByRole('button').first(), isoInDays(4))
    await page.fill('#time', '11:00')
    await pickSearchable(page, '#interviewer', userName(ctx, 'admin'))
    await page.fill('#meeting-link', 'https://meet.google.com/xpd-qwer-tyu')
    await page.locator('#send-invitation').filter({ visible: true }).first().check()
    await settle(page, 300)
    const fieldOf = (selector: string) => page.locator(selector).locator('xpath=ancestor::div[contains(@class,"space-y")][1]')
    await ctx.shot('interview-form', {
      fullPage: true,
      marks: [
        { target: page.locator('label[for="candidate"]').locator('xpath=..'), n: 1, badge: 'left' },
        { target: page.getByRole('radiogroup', { name: t('interviews.form.type') }), n: 2, badge: 'left' },
        { target: when, n: 3, badge: 'left' },
        { target: fieldOf('#interviewer'), n: 4, badge: 'left' },
        { target: fieldOf('#meeting-link'), n: 5, badge: 'left' },
        { target: page.locator('aside').filter({ hasText: t('interviews.form.summary') }), n: 6 },
      ],
    })

    // A Calendly booking link from a candidate's profile — Calendly is "connected" with the
    // demo token the walkthrough server answers for (scripts/guide-mocks).
    const { data: calendly } = await ctx.admin
      .from('organization_integrations')
      .select('id')
      .eq('organization_id', ctx.orgId)
      .eq('platform', 'calendly')
      .maybeSingle()
    if (!calendly) {
      console.warn(`  [${ctx.locale}] Calendly isn't seeded — skipping the Calendly link shots`)
      return
    }
    await ctx.goto(`/candidates/${await candidateId(ctx, 'c1')}`)
    const actions = page.getByRole('region', { name: t('rail.actions'), exact: true })
    const calendlyButton = actions.getByRole('button', { name: t('calLink.button') })
    await calendlyButton.waitFor()
    await settle(page, 300)
    await ctx.shot('calendly-link', { clip: actions, clipPad: 32, marks: [{ target: calendlyButton, n: 1, badge: 'left' }] })
    await calendlyButton.click()
    const linkDialog = page.getByRole('dialog')
    await linkDialog.locator('#calendly-link-url').waitFor()
    await settle(page, 300)
    await ctx.shot('calendly-link-dialog', { clip: linkDialog, clipPad: 32 })
    await page.keyboard.press('Escape')
  },
}

// ── Offers ──────────────────────────────────────────────────────────────────

async function offerToken(ctx: ShotContext, key: string): Promise<string> {
  const { data } = await ctx.admin
    .from('offers')
    .select('public_token, applications!inner ( candidate_id )')
    .eq('organization_id', ctx.orgId)
    .eq('applications.candidate_id', await candidateId(ctx, key))
    .eq('status', 'sent')
    .single()
  if (!data) throw new Error(`no sent offer for ${key} — run npm run guide:seed`)
  return data.public_token as string
}

const offers: Flow = {
  topic: 'offers',
  async run(ctx) {
    const { page, t, demo } = ctx
    // A candidate at the offer stage without an offer yet: the inline form.
    await ctx.goto(`/candidates/${await candidateId(ctx, 'c10')}`)
    await page.locator('#of-amount').waitFor()
    await page.fill('#of-amount', '6500')
    await page.fill('#of-currency', 'GEL')
    const dates = cardOf(page.locator('#of-amount'))
    await pickDate(page, dates.getByRole('button', { name: t('common.dateFormat') }).first(), isoInDays(30))
    await pickDate(page, dates.getByRole('button', { name: t('common.dateFormat') }).first(), isoInDays(7))
    await page.fill('#of-body', demo.offers[0]!.body)
    await page.fill('#of-note', demo.offers[0]!.message ?? '')
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await settle(page, 300)
    const grid = (selector: string) => page.locator(selector).locator('xpath=ancestor::div[contains(@class,"grid")][1]')
    await ctx.shot('offer-create', {
      clip: dates,
      clipPad: 32,
      marks: [
        { target: grid('#of-amount'), n: 1, badge: 'left' },
        { target: grid('label[for="of-start"]'), n: 2, badge: 'left' },
        { target: page.locator('#of-body').locator('xpath=..'), n: 3, badge: 'left' },
        { target: page.locator('#of-note').locator('xpath=..'), n: 4, badge: 'left' },
        {
          target: dates.getByRole('button', {
            name: new RegExp(`^(${escapeRegExp(t('stageBlock.saveDraft'))}|${escapeRegExp(t('stageBlock.saveSend'))})$`),
          }),
          n: 5,
          union: true,
        },
      ],
    })

    // A sent offer: status, link, withdraw, and marking the hire.
    await ctx.goto(`/candidates/${await candidateId(ctx, 'c4')}`)
    const copy = page.getByRole('button', { name: t('offer.copyLink') })
    await copy.waitFor()
    const card = cardOf(copy)
    await ctx.shot('offer-sent', {
      clip: card,
      clipPad: 32,
      marks: [
        { target: copy, n: 1, badge: 'below' },
        { target: page.getByRole('button', { name: t('offer.withdraw') }), n: 2, badge: 'below' },
        { target: card.getByRole('button', { name: t('stageBlock.markHired') }), n: 3 },
      ],
    })

    // What the candidate sees.
    const guest = await ctx.openPage()
    await ctx.goto(`/offer/${await offerToken(ctx, 'c4')}`, guest)
    const accept = guest.getByRole('button', { name: t('offer.acceptOffer') })
    await accept.waitFor()
    await ctx.shot('offer-page', {
      page: guest,
      fullPage: true,
      marks: [{ target: accept.locator('xpath=..'), n: 1 }],
    })
  },
}

export const HIRING_FLOWS: Flow[] = [pipeline, assessments, reject, interviews, offers]
