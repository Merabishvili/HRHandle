/**
 * Guide flows for the "Communication" section: what candidates see, the
 * emails they get (Settings → Email templates) and the team's notifications
 * in Slack and Teams. Nothing is saved.
 */
import type { Flow, ShotContext } from '../screenshot-config'
import { candidateId, escapeRegExp, settle } from './helpers'

/** The private status-page token of a demo candidate's (only) application. */
async function statusToken(ctx: ShotContext, key: string): Promise<string> {
  const { data } = await ctx.admin
    .from('applications')
    .select('public_token')
    .eq('organization_id', ctx.orgId)
    .eq('candidate_id', await candidateId(ctx, key))
    .is('deleted_at', null)
    .single()
  if (!data?.public_token) throw new Error(`no application for ${key} — run npm run guide:seed`)
  return data.public_token as string
}

// ── What candidates see ─────────────────────────────────────────────────────

const candidateExperience: Flow = {
  topic: 'candidate-experience',
  async run(ctx) {
    const { t } = ctx
    const guest = await ctx.openPage()

    // A candidate at the offer stage: progress, the offer, and the way out.
    await ctx.goto(`/status/${await statusToken(ctx, 'c4')}`, guest)
    const withdraw = guest.getByRole('button', { name: t('withdraw.button') })
    await withdraw.waitFor()
    await ctx.shot('candidate-status', {
      page: guest,
      fullPage: true,
      marks: [
        { target: guest.locator('ol').first(), n: 1 },
        { target: guest.locator('a[href^="/offer/"]'), n: 2 },
        { target: guest.getByText(t('status.subtitle.offer')).locator('xpath=..'), n: 3 },
        { target: withdraw.locator('xpath=..'), n: 4 },
      ],
    })

    // Withdrawing (not confirmed).
    await withdraw.click()
    const dialog = guest.getByRole('alertdialog')
    await dialog.waitFor()
    await settle(guest, 300)
    await ctx.shot('candidate-withdraw', { page: guest, clip: dialog, clipPad: 24 })
    await guest.keyboard.press('Escape')

    // A rejected candidate sees a neutral "Closed".
    await ctx.goto(`/status/${await statusToken(ctx, 'c9')}`, guest)
    const closed = guest.getByText(t('status.subtitle.closed')).locator('xpath=..')
    await closed.waitFor()
    await ctx.shot('candidate-status-closed', { page: guest, fullPage: true, marks: [{ target: closed, n: 1 }] })
  },
}

// ── Email templates ─────────────────────────────────────────────────────────

const emailTemplates: Flow = {
  topic: 'candidate-emails',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/settings/email-templates')
    const tab = (key: string) => page.getByRole('button', { name: t(key), exact: true })
    await tab('emailTpl.appReceived.label').waitFor()
    await settle(page, 300)
    await ctx.shot('email-templates', {
      fullPage: true,
      marks: [
        { target: tab('emailTpl.appReceived.label').locator('xpath=..'), n: 1, badge: 'left' },
        { target: page.locator('code').first().locator('xpath=..'), n: 2, badge: 'left' },
        { target: page.getByText(t('emailTpl.subjectLine'), { exact: true }).locator('xpath=ancestor::div[contains(@class,"space-y-4")][1]'), n: 3, badge: 'left' },
        { target: page.getByText(t('emailTpl.preview'), { exact: true }).locator('xpath=..'), n: 4 },
      ],
    })

    // An automatic stage email: off until you switch it on.
    await tab('emailTpl.statusScreening.label').click()
    const auto = page.getByRole('switch', { name: t('emailTpl.enableAria') })
    await auto.waitFor()
    await settle(page, 300)
    await ctx.shot('email-templates-auto', {
      fullPage: true,
      marks: [{ target: auto.locator('xpath=..'), n: 1, badge: 'left' }],
    })

    // Rejection emails, one per reason.
    await tab('emailTpl.tab.rejection').click()
    const addTemplate = page.getByRole('button', { name: t('rejectTpl.addTemplate') })
    await addTemplate.waitFor()
    await settle(page, 300)
    const reasonPrefix = new RegExp(`^${escapeRegExp(t('rejectTpl.reasonLabel', { name: '' }).trim())}`)
    await ctx.shot('email-templates-rejection', {
      fullPage: true,
      marks: [
        { target: page.getByText(reasonPrefix).first().locator('xpath=ancestor::div[contains(@class,"border")][1]'), n: 1, badge: 'left' },
        { target: addTemplate, n: 2, badge: 'below' },
      ],
    })
  },
}

// ── Notifications, Slack and Teams ──────────────────────────────────────────

const notifications: Flow = {
  topic: 'notifications',
  async run(ctx) {
    const { page, t, demo } = ctx
    await ctx.goto('/settings/integrations/webhooks')
    const add = page.getByRole('button', { name: t('webhooks.add') })
    await add.waitFor()
    const card = page.getByText(demo.slackChannel, { exact: true }).locator('xpath=ancestor::*[@data-slot="card"][1]')
    await ctx.shot('slack-teams', {
      fullPage: true,
      marks: [
        { target: add, n: 1, badge: 'below' },
        { target: card.locator('div.items-start').first(), n: 2, badge: 'left' },
        { target: card.locator('div.border-t').first(), n: 3, badge: 'left' },
      ],
    })

    // Adding a channel (not saved).
    await add.click()
    const name = page.locator('#wh-name')
    await name.waitFor()
    const form = name.locator('xpath=ancestor::*[@data-slot="card"][1]')
    const field = (selector: string) => page.locator(selector).locator('xpath=ancestor::div[contains(@class,"space-y")][1]')
    await ctx.shot('slack-teams-add', {
      clip: form,
      clipPad: 32,
      marks: [
        { target: page.getByText(t('webhooks.channel'), { exact: true }).locator('xpath=..'), n: 1, badge: 'left' },
        { target: field('#wh-name'), n: 2, badge: 'left' },
        { target: field('#wh-url'), n: 3, badge: 'left' },
        { target: page.getByText(t('webhooks.events'), { exact: true }).locator('xpath=..'), n: 4, badge: 'left' },
      ],
    })
  },
}

export const COMMUNICATION_FLOWS: Flow[] = [candidateExperience, emailTemplates, notifications]
