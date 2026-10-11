/**
 * Shared helpers for the guide screenshot flows (scripts/guide-flows/*).
 * Everything here finds elements by id, role or the app's translated labels —
 * never by English text — so it works in every language.
 */
import type { Locator, Page } from 'playwright'
import type { ShotContext } from '../screenshot-config'
import { fullName } from '../guide-demo-data'

/** Pick an option in a Radix <Select> by its visible (translated) label. */
export async function pickSelect(page: Page, trigger: string | Locator, option: string): Promise<void> {
  await (typeof trigger === 'string' ? page.locator(trigger) : trigger).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

/** Pick an option in a SearchableSelect (combobox + search list). */
export async function pickSearchable(page: Page, trigger: string, option: string): Promise<void> {
  await page.locator(trigger).click()
  await page.getByRole('option', { name: option }).first().click()
}

/** Pick a day in the DatePicker popover, paging months forward as needed. */
export async function pickDate(page: Page, trigger: Locator, isoDay: string): Promise<void> {
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

export const isoInDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The closest ancestor `div` of a locator (e.g. a field's label + input wrapper). */
export const parentDiv = (l: Locator) => l.locator('xpath=ancestor::div[1]')

/** A demo vacancy's id (by its title in this language). */
export async function vacancyId(ctx: ShotContext, key: string): Promise<string> {
  const title = ctx.demo.vacancies.find((v) => v.key === key)?.title ?? ctx.demo.trash.vacancy.title
  const { data } = await ctx.admin
    .from('vacancies')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('title', title)
    .is('deleted_at', null)
    .single()
  if (!data) throw new Error(`vacancy "${title}" not found — run npm run guide:seed`)
  return data.id as string
}

/** A demo candidate's id (by email). */
export async function candidateId(ctx: ShotContext, key: string): Promise<string> {
  const email = ctx.demo.candidates.find((c) => c.key === key)!.email
  const { data } = await ctx.admin
    .from('candidates')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('email', email)
    .is('deleted_at', null)
    .single()
  if (!data) throw new Error(`candidate ${email} not found — run npm run guide:seed`)
  return data.id as string
}

export const candidateName = (ctx: ShotContext, key: string) =>
  fullName(ctx.demo.candidates.find((c) => c.key === key)!)

export const vacancyTitle = (ctx: ShotContext, key: string) => ctx.demo.vacancies.find((v) => v.key === key)!.title

export const userName = (ctx: ShotContext, key: 'owner' | 'admin' | 'member') =>
  ctx.demo.users.find((u) => u.key === key)!.fullName

/** Delete a demo vacancy created by a flow, with everything hanging off it. */
export async function deleteVacancyByTitle(ctx: ShotContext, title: string): Promise<void> {
  const { data: rows } = await ctx.admin
    .from('vacancies')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('title', title)
  for (const { id } of rows ?? []) {
    await ctx.admin.from('custom_field_values').delete().eq('entity_id', id)
    await ctx.admin.from('activity_log').delete().eq('entity_id', id)
    await ctx.admin.from('vacancies').delete().eq('id', id)
  }
}

/** Wait for client-side navigation/data to settle after an action. */
export async function settle(page: Page, ms = 400): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}
