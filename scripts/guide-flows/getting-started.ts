/**
 * Guide flows for the "Getting started" section: sign-up, finding your way
 * around, profile & security, organization settings, team & roles.
 */
import type { Locator, Page } from 'playwright'
import type { Flow, ShotContext } from '../screenshot-config'
import type { Locale } from '@/lib/i18n/locales'
import { DEMO_PASSWORD } from '../guide-demo-data'
import { escapeRegExp, settle, userName } from './helpers'

/** A shadcn <Card> that contains `inner` (the card root carries data-slot="card"). */
const cardOf = (inner: Locator) => inner.locator('xpath=ancestor::*[@data-slot="card"][1]')
const cardTitled = (page: Page, title: string) =>
  cardOf(page.locator('[data-slot="card-title"]').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(title)}`) }).first())

// ── Sign up and create your organization ────────────────────────────────────

/** The brand-new person who signs up in the onboarding shots (deleted afterwards). */
const NEWCOMER: Record<Locale, { name: string; company: string }> = {
  en: { name: 'Alex Morgan', company: 'Green Valley LLC' },
  ka: { name: 'ნიკა ბერიშვილი', company: 'მწვანე ველი' },
  ru: { name: 'Ирина Громова', company: 'Зелёная долина' },
}
const newcomerEmail = (ctx: ShotContext) => `guide.${ctx.locale}.newcomer@example.com`

/** Remove the newcomer's account and the organization it created. */
async function deleteNewcomer(ctx: ShotContext): Promise<void> {
  const email = newcomerEmail(ctx)
  const { data: profile } = await ctx.admin.from('profiles').select('id, organization_id').eq('email', email).maybeSingle()
  let userId = profile?.id as string | undefined
  if (!userId) {
    for (let page = 1; page < 50 && !userId; page++) {
      const { data } = await ctx.admin.auth.admin.listUsers({ page, perPage: 200 })
      userId = data.users.find((u) => u.email === email)?.id
      if (!data.users.length || data.users.length < 200) break
    }
  }
  const orgId = profile?.organization_id as string | undefined
  if (orgId) {
    for (const table of ['rejection_templates', 'rejection_reasons', 'org_pipeline_stage_templates', 'subscriptions', 'notifications', 'activity_log']) {
      await ctx.admin.from(table).delete().eq('organization_id', orgId)
    }
    await ctx.admin.from('profiles').delete().eq('organization_id', orgId)
    const { error } = await ctx.admin.from('organizations').delete().eq('id', orgId)
    if (error) console.warn(`  [${ctx.locale}] newcomer org not deleted: ${error.message}`)
  }
  if (userId) await ctx.admin.auth.admin.deleteUser(userId)
}

const signUp: Flow = {
  topic: 'sign-up-and-onboarding',
  async run(ctx) {
    const { t } = ctx

    // 1 — The sign-up page, signed out.
    const guest = await ctx.openPage()
    await ctx.goto('/auth/sign-up', guest)
    await guest.locator('#fullName').waitFor()
    await guest.waitForTimeout(2500) // the captcha widget
    const google = guest.getByRole('button', { name: t('auth.continueGoogle') })
    await ctx.shot('signup-form', {
      page: guest,
      marks: [
        { target: google.locator('xpath=..'), n: 1 },
        { target: guest.locator('form'), n: 2, badge: 'left' },
      ],
    })

    // 2 — "Check your email".
    await ctx.goto('/auth/sign-up-success', guest)
    await ctx.shot('signup-check-email', { page: guest })

    // 3 — Google/Microsoft sign-ups finish on the onboarding page; a real new user.
    await deleteNewcomer(ctx)
    const created = await ctx.admin.auth.admin.createUser({
      email: newcomerEmail(ctx),
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { locale: ctx.locale },
    })
    if (created.error) throw created.error
    const fresh = await ctx.openPage({ email: newcomerEmail(ctx) })
    await ctx.goto('/onboarding/company', fresh)
    await fresh.locator('#companyName').waitFor()
    await fresh.fill('#fullName', NEWCOMER[ctx.locale].name)
    await fresh.fill('#companyName', NEWCOMER[ctx.locale].company)
    const openPortal = fresh.getByRole('button', { name: t('onboarding.openPortal') })
    await ctx.shot('onboarding-company', {
      page: fresh,
      marks: [
        { target: fresh.locator('#fullName').locator('xpath=..'), n: 1, badge: 'left' },
        { target: fresh.locator('#companyName').locator('xpath=..'), n: 2, badge: 'left' },
        { target: openPortal, n: 3, badge: 'left' },
      ],
    })

    // 4 — The first screen: an empty pipeline and the 7-day trial.
    await openPortal.click()
    await fresh.waitForURL(/\/pipeline/, { timeout: 30_000 })
    await settle(fresh, 1000)
    await ctx.shot('first-login', {
      page: fresh,
      marks: [
        { target: fresh.locator('header a[href="/settings/billing"]').first().locator('xpath=..'), n: 1, badge: 'below' },
        { target: fresh.getByRole('link', { name: t('pipeline.empty.createVacancy') }).or(fresh.getByRole('button', { name: t('pipeline.empty.createVacancy') })).first(), n: 2, badge: 'left' },
      ],
    })
  },
  cleanup: deleteNewcomer,
}

// ── Find your way around ────────────────────────────────────────────────────

const navigation: Flow = {
  topic: 'navigation',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/pipeline')
    const sidebar = page.getByRole('complementary', { name: t('sidebar.primaryNav') })
    await sidebar.waitFor()
    const bell = page.getByRole('button', { name: new RegExp(`^${escapeRegExp(t('notifications.title'))}`) })
    const account = page.getByRole('button', { name: t('header.accountMenu', { name: userName(ctx, 'owner') }) })
    await ctx.shot('nav-overview', {
      marks: [
        { target: sidebar.locator('nav').getByRole('link'), union: true, n: 1 },
        { target: page.getByRole('button', { name: t('header.openSearch') }), n: 2, badge: 'below' },
        { target: page.getByRole('link', { name: t('header.help') }), n: 3, badge: 'below' },
        { target: bell, n: 4, badge: 'below' },
        { target: account, n: 5, badge: 'below' },
        { target: page.getByText(t('sidebar.plan'), { exact: true }).locator('xpath=ancestor::div[contains(@class,"border-t")][1]'), n: 6, badge: 'right' },
      ],
    })

    // Notifications panel.
    await bell.click()
    const panel = page.getByText(t('notifications.title'), { exact: true }).locator('xpath=ancestor::div[contains(@class,"w-80")][1]')
    await panel.waitFor()
    await ctx.shot('nav-notifications', { clip: panel, clipPad: 16 })
    await page.keyboard.press('Escape')
    await page.mouse.click(5, 450)

    // Account menu.
    await account.click()
    const menu = page.getByRole('menu')
    await menu.waitFor()
    await ctx.shot('nav-account-menu', { clip: menu, clipPad: 16 })
    await page.keyboard.press('Escape')
  },
}

// ── Your profile and security ───────────────────────────────────────────────

const profileSecurity: Flow = {
  topic: 'profile-and-security',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/settings/profile')
    await page.locator('#fullName').waitFor()
    await ctx.shot('profile-settings', {
      fullPage: true,
      marks: [
        { target: page.getByRole('button', { name: t('avatar.change') }).locator('xpath=ancestor::div[2]'), n: 1, badge: 'left' },
        { target: page.locator('#fullName').locator('xpath=..'), n: 2, badge: 'left' },
        { target: page.locator('label[for="language"]').locator('xpath=..'), n: 3, badge: 'left' },
      ],
    })

    await ctx.goto('/settings/security')
    await page.locator('#current-password').waitFor()
    await ctx.shot('security-settings', {
      fullPage: true,
      marks: [
        { target: cardTitled(page, t('settingsPage.password')), n: 1, badge: 'left' },
        { target: cardTitled(page, t('mfa.twoFactor')), n: 2, badge: 'left' },
        { target: cardTitled(page, t('sessions.title')), n: 3, badge: 'left' },
      ],
    })

    await ctx.goto('/settings/notifications')
    await page.getByRole('button', { name: t('notifPrefs.savePrefs') }).waitFor()
    await ctx.shot('notification-settings', { fullPage: true })
  },
}

// ── Organization settings ───────────────────────────────────────────────────

const organizationSettings: Flow = {
  topic: 'organization-settings',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/settings/organization')
    const orgCard = cardTitled(page, t('settings.org.title'))
    await orgCard.waitFor()
    await ctx.shot('organization-settings', {
      clip: orgCard,
      clipPad: 48,
      marks: [
        { target: orgCard.getByText(t('settings.org.logo'), { exact: true }).locator('xpath=..'), n: 1, badge: 'left' },
        { target: orgCard.getByLabel(t('settings.org.name')).locator('xpath=ancestor::div[1]'), n: 2, badge: 'left' },
        { target: orgCard.getByText(t('settings.org.publicUrl'), { exact: true }).locator('xpath=ancestor::div[1]'), n: 3, badge: 'left' },
      ],
    })
    await ctx.shot('organization-policies', {
      fullPage: true,
      marks: [
        { target: cardTitled(page, t('settings.mfa.title')), n: 1, badge: 'left' },
        { target: cardTitled(page, t('settings.orgLang.title')), n: 2, badge: 'left' },
        { target: cardTitled(page, t('settings.aiFit.title')), n: 3, badge: 'left' },
        { target: cardTitled(page, t('vacSettings.dangerZone')), n: 4, badge: 'left' },
      ],
    })
    const residency = cardTitled(page, t('billingResidency.cardTitle'))
    await residency.scrollIntoViewIfNeeded()
    await settle(page, 300)
    await ctx.shot('organization-residency', {
      clip: residency,
      clipPad: 40,
      marks: [{ target: residency.getByRole('radiogroup'), n: 1, badge: 'left' }],
    })
  },
}

// ── Team and roles ──────────────────────────────────────────────────────────

const teamRoles: Flow = {
  topic: 'team-and-roles',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/settings/team')
    await page.locator('#invite-email').waitFor()
    const section = (title: string) =>
      page.getByRole('heading', { name: title, exact: true }).locator('xpath=..')
    await ctx.shot('team-page', {
      fullPage: true,
      marks: [
        { target: section(t('team.members')), n: 1, badge: 'left' },
        { target: section(t('team.inviteTitle')), n: 2, badge: 'left' },
        { target: section(t('team.pendingInvitations')), n: 3, badge: 'left' },
      ],
    })

    // A member's menu: change role, reset 2FA, remove.
    await page.getByRole('button', { name: t('team.manageAria', { name: userName(ctx, 'member') }) }).click()
    const menu = page.getByRole('menu')
    await menu.waitFor()
    await ctx.shot('team-member-menu', { marks: [{ target: menu, n: 1 }] })
    await page.keyboard.press('Escape')
  },
}

export const GETTING_STARTED_FLOWS: Flow[] = [signUp, navigation, profileSecurity, organizationSettings, teamRoles]
