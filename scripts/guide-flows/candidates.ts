/**
 * Guide flows for the "Candidates" section: add a candidate (CV upload with
 * AI), import from a spreadsheet, the candidate profile, search and filters.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Flow, ShotContext } from '../screenshot-config'
import type { DemoCv } from '../guide-demo-data'
import { IMPORT_FIELDS } from '@/lib/candidate-import/parsing'
import { candidateId, escapeRegExp, settle, vacancyTitle } from './helpers'

// ── Add a candidate ─────────────────────────────────────────────────────────

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** A one-page CV in the language's own words — what a candidate would send. */
function cvHtml(cv: DemoCv): string {
  const e = escapeHtml
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; margin: 48px; color: #111; }
    h1 { margin: 0; font-size: 28px; } .sub { color: #555; margin: 4px 0 18px; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 22px; }
    .job { margin: 10px 0; } .job b { display: block; } .muted { color: #666; font-size: 13px; }
  </style></head><body>
    <h1>${e(cv.firstName)} ${e(cv.lastName)}</h1>
    <div class="sub">${e(cv.title)} · ${e(cv.location)} · ${e(cv.email)} · ${e(cv.phone)}</div>
    <p>${e(cv.summary)}</p>
    <h2>${e(cv.headings.experience)}</h2>
    ${cv.experience.map((j) => `<div class="job"><b>${e(j.title)} — ${e(j.company)}</b><span class="muted">${e(j.period)}</span><div>${e(j.text)}</div></div>`).join('')}
    <h2>${e(cv.headings.education)}</h2>
    <div class="job"><b>${e(cv.education.degree)}</b><span class="muted">${e(cv.education.school)} · ${e(cv.education.period)}</span></div>
    <h2>${e(cv.headings.skills)}</h2><div>${e(cv.skills)}</div>
    <h2>${e(cv.headings.languages)}</h2><div>${e(cv.languages)}</div>
  </body></html>`
}

async function makeCvPdf(ctx: ShotContext): Promise<string> {
  const printer = await ctx.openPage()
  await printer.setContent(cvHtml(ctx.demo.cv), { waitUntil: 'load' })
  const file = path.join(os.tmpdir(), `CV_${ctx.demo.cv.email.split('@')[0]}.pdf`)
  await printer.pdf({ path: file, format: 'A4', printBackground: true })
  return file
}

/** The candidate wizard's footer "Next: …" button. */
const candidateNext = (ctx: ShotContext, stepKey: string) =>
  ctx.page.getByRole('button', { name: ctx.t('candWizard.wizard.nextLabel', { label: ctx.t(stepKey) }) })

const addCandidates: Flow = {
  topic: 'add-candidates',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto('/candidates')
    const add = page.getByRole('link', { name: t('candidates.addCandidate') }).first()
    await add.waitFor()
    await ctx.shot('candidates-add-button', { marks: [{ target: add, n: 1, badge: 'below' }] })

    // Step 1 — choose how to add the candidate.
    await add.click()
    const cvPath = page.getByRole('button', { name: new RegExp(escapeRegExp(t('candWizard.path.cvTitle'))) })
    const manualPath = page.getByRole('button', { name: new RegExp(escapeRegExp(t('candWizard.path.manualTitle'))) })
    await cvPath.waitFor()
    await ctx.shot('add-candidate-path', { marks: [{ target: cvPath, n: 1 }, { target: manualPath, n: 2 }] })

    // Step 2 — upload the CV; the AI fills the form.
    await cvPath.click()
    await candidateNext(ctx, 'candWizard.wizard.stepPersonal').click()
    const pdf = await makeCvPdf(ctx)
    await page.locator('input[type="file"][accept=".pdf,.doc,.docx"]').setInputFiles(pdf)
    await page.getByText(t('candWizard.personal.parsedOk')).waitFor({ timeout: 90_000 })
    await settle(page, 600)
    await ctx.shot('add-candidate-personal', {
      fullPage: true,
      marks: [
        { target: page.getByText(path.basename(pdf)).locator('xpath=ancestor::div[contains(@class,"rounded")][1]'), n: 1, badge: 'left' },
        { target: page.locator('#first_name').locator('xpath=ancestor::div[contains(@class,"grid")][1]'), n: 2, badge: 'left' },
      ],
    })

    // Step 3 — experience and education, read from the CV.
    await candidateNext(ctx, 'candWizard.wizard.stepBackground').click()
    await settle(page, 500)
    await ctx.shot('add-candidate-background', { fullPage: true })

    // Step 4 — the vacancy, starting stage and source.
    await candidateNext(ctx, 'candWizard.wizard.stepApplication').click()
    await page.locator('#vacancy').waitFor()
    await page.locator('#vacancy').click()
    await page.getByRole('option', { name: vacancyTitle(ctx, 'engineer'), exact: true }).click()
    await page.locator('#source').click()
    await page.getByRole('option', { name: 'LinkedIn', exact: true }).click()
    await ctx.shot('add-candidate-application', {
      fullPage: true,
      marks: [
        { target: page.locator('label[for="vacancy"]').locator('xpath=..'), n: 1, badge: 'below' },
        { target: page.getByText(t('candWizard.application.startingStage'), { exact: true }).locator('xpath=..'), n: 2, badge: 'left' },
        { target: page.locator('label[for="source"]').locator('xpath=..'), n: 3, badge: 'left' },
      ],
    })

    // Step 5 — review (not saved: the walkthrough leaves the demo data unchanged).
    await candidateNext(ctx, 'candWizard.wizard.stepReview').click()
    await settle(page, 500)
    await ctx.shot('add-candidate-review', {
      fullPage: true,
      marks: [
        { target: page.getByRole('button', { name: t('candidateForm.addCandidate'), exact: true }), n: 1 },
        { target: page.getByRole('button', { name: t('candWizard.wizard.saveAddAnother') }), n: 2 },
      ],
    })
  },
}

// ── Import candidates ───────────────────────────────────────────────────────

const csvCell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const importFileName = (ctx: ShotContext) => `candidates-${ctx.locale}.csv`

async function deleteImport(ctx: ShotContext): Promise<void> {
  const { data: imports } = await ctx.admin
    .from('candidate_imports')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('filename', importFileName(ctx))
  const ids = (imports ?? []).map((i) => i.id as string)
  if (ids.length) {
    await ctx.admin.from('candidates').delete().in('import_id', ids)
    await ctx.admin.from('activity_log').delete().eq('organization_id', ctx.orgId).eq('action', 'candidates_imported')
    await ctx.admin.from('candidate_imports').delete().in('id', ids)
  }
  await ctx.admin.from('candidate_import_drafts').delete().eq('organization_id', ctx.orgId)
}

const importCandidates: Flow = {
  topic: 'import-candidates',
  async run(ctx) {
    const { page, t } = ctx
    await deleteImport(ctx)
    const file = path.join(os.tmpdir(), importFileName(ctx))
    const rows = [IMPORT_FIELDS as readonly string[], ...ctx.demo.importRows]
    fs.writeFileSync(file, rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n', 'utf8')

    // Upload.
    await ctx.goto('/candidates/import')
    const template = page.locator('a[href="/api/candidates/import/template"]')
    await template.waitFor()
    await ctx.shot('import-upload', {
      marks: [
        { target: template, n: 1 },
        { target: page.getByRole('button', { name: t('csvImport.chooseFile') }).locator('xpath=ancestor::div[contains(@class,"border-dashed")][1]'), n: 2 },
      ],
    })

    // Review: every row checked, errors explained.
    await page.locator('input[type="file"]').setInputFiles(file)
    const next = page.getByRole('button', { name: t('csvImport.nextConfirm') })
    await next.waitFor({ timeout: 30_000 })
    await settle(page, 600)
    const deleteErrored = page.getByRole('button', { name: t('csvImport.deleteAllErrored') })
    await ctx.shot('import-review', {
      fullPage: true,
      marks: [
        { target: page.getByRole('table'), n: 1, badge: 'left' },
        { target: deleteErrored, n: 2 },
        { target: next, n: 3 },
      ],
    })

    // Fix the file by removing the two bad rows (a browser confirm), then confirm and import.
    page.once('dialog', (dialog) => void dialog.accept())
    await deleteErrored.click()
    await settle(page, 600)
    await next.click()
    const commit = page.getByRole('button', { name: t('csvImport.commitN', { n: 3 }) })
    await commit.waitFor()
    await ctx.shot('import-confirm', { fullPage: true, marks: [{ target: commit, n: 1 }] })

    await commit.click()
    await page.getByText(t('csvImport.importComplete')).first().waitFor({ timeout: 90_000 })
    await settle(page, 800)
    await ctx.shot('import-done', { fullPage: true })
  },
  cleanup: deleteImport,
}

// ── The candidate profile ───────────────────────────────────────────────────

/** A profile card by its title text (the visible copy — the side panel renders twice). */
const cardWithHeading = (ctx: ShotContext, text: string) =>
  ctx.page
    .getByText(text, { exact: true })
    .filter({ visible: true })
    .first()
    .locator('xpath=ancestor::*[contains(@class,"border")][1]')

const candidateProfile: Flow = {
  topic: 'candidate-profile',
  async run(ctx) {
    const { page, t } = ctx
    await ctx.goto(`/candidates/${await candidateId(ctx, 'c1')}`)
    const addToVacancy = page.getByRole('button', { name: t('addApp.title') })
    await addToVacancy.waitFor()
    await settle(page, 800)

    // The top of the profile: header, active application, stage card, actions, documents.
    await ctx.shot('candidate-profile', {
      marks: [
        { target: addToVacancy.locator('xpath=..'), n: 1, badge: 'below' },
        { target: page.getByText(t('activeApp.label'), { exact: true }).locator('xpath=..'), n: 2, badge: 'left' },
        { target: page.getByRole('button', { name: t('stageBlock.editScorecard') }).locator('xpath=ancestor::*[contains(@class,"rounded-xl")][1]'), n: 3, badge: 'left' },
        // the side panel is rendered twice (desktop + mobile layout): mark the visible one
        { target: page.getByText(t('rail.actions'), { exact: true }).filter({ visible: true }).first().locator('xpath=ancestor::*[contains(@class,"border")][1]'), n: 4 },
        {
          // the card title, not the activity feed's "Documents" filter chip
          target: page.locator('[data-slot="card-title"]').filter({ hasText: t('documents.title') }).filter({ visible: true }).first()
            .locator('xpath=ancestor::*[@data-slot="card"][1]'),
          n: 5,
        },
      ],
    })

    // Activity: notes with @mentions, interviews, stage changes, documents.
    const activity = cardWithHeading(ctx, t('activity.title'))
    const owner = ctx.demo.users.find((u) => u.key === 'owner')!.fullName
    await ctx.shot('candidate-activity', {
      clip: activity,
      clipPad: 40,
      marks: [
        { target: activity.getByText(new RegExp(escapeRegExp(`@${owner}`))).first(), n: 1, badge: 'left' },
        { target: activity.getByPlaceholder(t('activity.notePlaceholder')), n: 2, badge: 'left' },
      ],
    })

    // ⋯ → Merge candidates.
    await page.getByRole('button', { name: t('profileShell.moreActions') }).click()
    await page.getByRole('menuitem', { name: t('merge.title') }).click()
    const merge = page.getByRole('dialog')
    await merge.waitFor()
    await merge.getByRole('textbox').fill(ctx.demo.candidates[0]!.lastName)
    await page.waitForTimeout(2500) // the matching candidates load
    await ctx.shot('candidate-merge', { clip: merge, clipPad: 24 })
    await page.keyboard.press('Escape')
  },
}

// ── Search and filters ──────────────────────────────────────────────────────

const searchFilters: Flow = {
  topic: 'search-and-filters',
  async run(ctx) {
    const { page, t, demo } = ctx
    await ctx.goto('/pipeline')
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    await page.getByPlaceholder(t('search.placeholder')).fill(demo.candidates[0]!.firstName)
    await page.waitForTimeout(1500)
    await ctx.shot('search-palette', { clip: dialog, clipPad: 24 })
    await page.keyboard.press('Escape')

    await ctx.goto('/candidates')
    const search = page.getByPlaceholder(t('candidates.searchPlaceholder'))
    await search.waitFor()
    const columns = page.getByRole('button', { name: t('candidates.columns') })
    await ctx.shot('candidates-list-tools', {
      marks: [
        { target: search, n: 1, badge: 'left' },
        { target: page.getByRole('button', { name: t('candidates.allTab') }).locator('xpath=..'), n: 2, badge: 'left' },
        { target: columns.locator('xpath=..'), n: 3, badge: 'below' },
        { target: page.getByRole('link', { name: t('candidates.exportCsv') }).locator('xpath=..'), n: 4, badge: 'left' },
      ],
    })

    await columns.click()
    const columnsDialog = page.getByRole('dialog')
    await columnsDialog.waitFor()
    await ctx.shot('columns-dialog', { clip: columnsDialog, clipPad: 24 })
    await page.keyboard.press('Escape')
  },
}

export const CANDIDATE_FLOWS: Flow[] = [addCandidates, importCandidates, candidateProfile, searchFilters]
