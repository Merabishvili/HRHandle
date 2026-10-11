/**
 * Guide flows for the "Administration" section: integrations, custom fields,
 * the audit log and trash, plans and billing. Nothing is saved, connected or
 * paid for.
 */
import type { Flow } from '../screenshot-config'
import { escapeRegExp, settle } from './helpers'

const startsWith = (s: string) => new RegExp(`^${escapeRegExp(s)}`)

// ── Integrations ────────────────────────────────────────────────────────────

const integrations: Flow = {
  topic: 'integrations',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/settings/integrations')
    const row = (title: string) =>
      page.getByText(title, { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"justify-between")][1]')
    await page.getByText(t('gcalConnect.title'), { exact: true }).waitFor()
    await settle(page, 300)
    await ctx.shot('integrations', {
      marks: [
        { target: row(t('gcalConnect.title')), n: 1, badge: 'left' },
        { target: row('Zoom'), n: 2, badge: 'left' },
        { target: row(t('msConnect.title')), n: 3, badge: 'left' },
      ],
    })

    // The company's LinkedIn page — connected in the demo organizations.
    const linkedIn = row(t('liConnect.title'))
    await linkedIn.scrollIntoViewIfNeeded()
    await settle(page, 300)
    await ctx.shot('integrations-linkedin', { clip: linkedIn, clipPad: 40, marks: [{ target: linkedIn, n: 1, badge: 'left' }] })

    // Calendly, connected with the demo token the walkthrough server answers for
    // (scripts/guide-mocks). Needs the Calendly row — the seed skips it until
    // 20261010_organization_integrations_fixes.sql is applied.
    const { data: calendly } = await ctx.admin
      .from('organization_integrations')
      .select('id')
      .eq('organization_id', ctx.orgId)
      .eq('platform', 'calendly')
      .maybeSingle()
    if (!calendly) {
      console.warn(`  [${ctx.locale}] Calendly isn't seeded — skipping integrations-calendly`)
      return
    }
    await ctx.goto('/settings/integrations/calendly')
    const owner = ctx.demo.users.find((u) => u.key === 'owner')!.fullName
    const connected = page.getByText(t('calendly.connectedAs', { name: owner }), { exact: true })
    await connected.waitFor()
    await page.getByRole('combobox').waitFor()
    await settle(page, 300)
    await ctx.shot('integrations-calendly', {
      marks: [
        { target: connected.locator('xpath=ancestor::div[contains(@class,"justify-between")][1]'), n: 1, badge: 'left' },
        { target: page.getByText(t('calendly.eventTypeLabel'), { exact: true }).locator('xpath=..'), n: 2, badge: 'left' },
      ],
    })
  },
}

// ── Custom fields ───────────────────────────────────────────────────────────

const customFields: Flow = {
  topic: 'custom-fields',
  async run(ctx) {
    const { page, t, demo } = ctx
    await ctx.goto('/settings/custom-fields')
    const groupToggle = page.getByRole('button', { name: startsWith(demo.candidateFields.group) })
    await groupToggle.waitFor()
    await groupToggle.click() // groups start folded
    const group = groupToggle.locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
    await group.getByRole('button', { name: t('customFields.addFieldLink') }).waitFor()
    await settle(page, 300)
    const heading = page.getByRole('heading', { name: t('customFields.fieldsHeading', { entity: t('customFields.candidate') }) })
    await ctx.shot('custom-fields', {
      fullPage: true,
      marks: [
        { target: page.getByRole('button', { name: t('nav.candidates'), exact: true }).locator('xpath=..'), n: 1, badge: 'left' },
        { target: heading.locator('xpath=..'), n: 2, badge: 'left' },
        { target: group, n: 3, badge: 'left' },
        { target: page.getByRole('button', { name: t('customFields.addGroup') }).locator('xpath=..'), n: 4, badge: 'left' },
      ],
    })

    // Adding a dropdown field to the group (not saved).
    await group.getByRole('button', { name: t('customFields.addFieldLink') }).click()
    const form = group.locator('div.border-dashed').first()
    await form.getByPlaceholder(t('customFields.fieldNamePlaceholder')).fill(demo.newCustomField.name)
    await form.getByRole('combobox').click()
    await page.getByRole('option', { name: t('customFields.typeDropdown'), exact: true }).click()
    await form.getByPlaceholder(t('customFields.optionsPlaceholder')).fill(demo.newCustomField.options.join(', '))
    await settle(page, 300)
    await ctx.shot('custom-field-add', { clip: form, clipPad: 28 })
  },
}

// ── Audit log and trash ─────────────────────────────────────────────────────

const auditTrash: Flow = {
  topic: 'audit-log-and-trash',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/settings/audit-log')
    const exportCsv = page.getByRole('link', { name: t('settingsPage.exportCsv') })
    await exportCsv.waitFor()
    await settle(page, 400)
    await ctx.shot('audit-log', {
      marks: [
        { target: exportCsv, n: 1, badge: 'below' },
        { target: page.getByRole('button', { name: t('auditFilters.apply') }).locator('xpath=ancestor::form[1]'), n: 2, badge: 'left' },
        { target: page.getByRole('table'), n: 3, badge: 'left' },
      ],
    })

    await ctx.goto('/settings/trash')
    const restore = page.getByRole('button', { name: t('trash.restore') }).first()
    await restore.waitFor()
    const row = restore.locator('xpath=ancestor::li[1]')
    await ctx.shot('trash', {
      fullPage: true,
      marks: [
        { target: page.getByRole('button', { name: startsWith(t('nav.candidates')) }).locator('xpath=..'), n: 1, badge: 'left' },
        { target: row, n: 2, badge: 'left' },
        { target: restore.locator('xpath=..'), n: 3, badge: 'below' },
      ],
    })
  },
}

// ── Plans and billing ───────────────────────────────────────────────────────

const billing: Flow = {
  topic: 'billing',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/settings/billing')
    const plans = page.getByRole('heading', { name: t('planCards.availablePlans') })
    await plans.waitFor()
    await settle(page, 400)
    await ctx.shot('billing', {
      fullPage: true,
      marks: [
        { target: page.locator('section').filter({ has: page.getByRole('heading', { name: startsWith(t('billing.currentPlan')) }) }).first(), n: 1, badge: 'left' },
        { target: page.getByRole('button', { name: startsWith(t('planCards.monthly')) }).locator('xpath=..'), n: 2, badge: 'left' },
        { target: plans.locator('xpath=../..').locator('div.grid').first(), n: 3, badge: 'left' },
        { target: page.getByText(t('billing.paymentMethod'), { exact: true }).locator('xpath=ancestor::section[1]'), n: 4, badge: 'left' },
      ],
    })
  },
}

export const ADMINISTRATION_FLOWS: Flow[] = [integrations, customFields, auditTrash, billing]
