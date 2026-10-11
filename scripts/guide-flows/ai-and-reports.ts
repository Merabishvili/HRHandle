/**
 * Guide flows for the "AI and reports" section. The AI walkthrough switches AI
 * Fit Analysis on for the demo company and seeds two finished analyses (no
 * model call, so the pictures are the same every run); its cleanup switches
 * the feature off again. The inclusive-language check runs for real.
 */
import type { Locator } from 'playwright'
import type { Flow, ShotContext } from '../screenshot-config'
import type { FitCriterion, RenderedFitAnalysis } from '@/lib/types/ai-fit'
import { candidateId, escapeRegExp, settle, vacancyId } from './helpers'

const startsWith = (s: string) => new RegExp(`^${escapeRegExp(s)}`)
const cardOf = (l: Locator) => l.locator('xpath=ancestor::*[@data-slot="card"][1]')

// ── AI Fit Analysis demo data ───────────────────────────────────────────────

/** Same threshold as lib/ai/fit-analysis.ts (not imported: it pulls in the model SDK). */
const MEETS_THRESHOLD = 60

async function applicationOf(ctx: ShotContext, key: string): Promise<string> {
  const { data } = await ctx.admin
    .from('applications')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('candidate_id', await candidateId(ctx, key))
    .is('deleted_at', null)
    .single()
  if (!data) throw new Error(`no application for ${key} — run npm run guide:seed`)
  return data.id as string
}

async function userId(ctx: ShotContext, role: 'owner' | 'admin'): Promise<string> {
  const { data } = await ctx.admin.from('profiles').select('id').eq('organization_id', ctx.orgId).eq('role', role).limit(1).single()
  return data!.id as string
}

async function aiFitOff(ctx: ShotContext): Promise<void> {
  await ctx.admin.from('ai_fit_analyses').delete().eq('organization_id', ctx.orgId)
  await ctx.admin
    .from('organizations')
    .update({ ai_fit_enabled: false, ai_fit_enabled_at: null, ai_fit_enabled_by: null })
    .eq('id', ctx.orgId)
}

async function aiFitOnWithAnalyses(ctx: ShotContext): Promise<void> {
  const { demo, orgId } = ctx
  const [owner, admin] = [await userId(ctx, 'owner'), await userId(ctx, 'admin')]
  await ctx.admin
    .from('organizations')
    .update({ ai_fit_enabled: true, ai_fit_enabled_at: new Date().toISOString(), ai_fit_enabled_by: owner })
    .eq('id', orgId)

  const criteria: FitCriterion[] = demo.engineerScorecard.map((c, i) => ({
    name: c.label,
    must_have: c.mustHave,
    match_degree: demo.aiFit.criteria[i]!.match,
    evidence: demo.aiFit.criteria[i]!.evidence,
    explanation: demo.aiFit.criteria[i]!.explanation,
  }))
  const mustHaveTotal = criteria.filter((c) => c.must_have).length
  const rendered: RenderedFitAnalysis = {
    meets_count: criteria.filter((c) => c.must_have && c.match_degree >= MEETS_THRESHOLD).length,
    must_have_total: mustHaveTotal,
    confidence: 'high',
    criteria,
    strengths: demo.aiFit.strengths,
    to_verify: demo.aiFit.toVerify.map((text) => ({ text })),
    suggested_questions: demo.aiFit.questions,
  }
  // The second analysis only feeds the AI oversight page (counts + override log).
  const overridden: RenderedFitAnalysis = {
    ...rendered,
    meets_count: 1,
    confidence: 'medium',
    criteria: criteria.map((c, i) => ({ ...c, match_degree: i === 1 ? 45 : c.match_degree })),
  }
  const base = {
    organization_id: orgId,
    status: 'completed',
    criteria_snapshot: demo.engineerScorecard.map((c) => ({ name: c.label, must_have: c.mustHave })),
    cv_snapshot_hash: 'guide-demo',
    redacted_categories: ['name', 'contact_details'],
    model_name: 'gemini-2.5-flash',
    prompt_version: 'fit-analysis-2',
    created_by: owner,
  }
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  const { error } = await ctx.admin.from('ai_fit_analyses').insert([
    {
      ...base,
      application_id: await applicationOf(ctx, 'c1'),
      meets_count: rendered.meets_count,
      must_have_total: mustHaveTotal,
      confidence: rendered.confidence,
      rendered_analysis: rendered,
      created_at: hoursAgo(2),
    },
    {
      ...base,
      application_id: await applicationOf(ctx, 'c4'),
      meets_count: overridden.meets_count,
      must_have_total: mustHaveTotal,
      confidence: overridden.confidence,
      rendered_analysis: overridden,
      assessment: 'override',
      assessment_reason: demo.aiFit.overrideReason,
      assessed_by: admin,
      assessed_at: hoursAgo(50),
      created_at: hoursAgo(52),
    },
  ])
  if (error) throw new Error(`ai_fit_analyses: ${error.message}`)
}

// ── AI features ─────────────────────────────────────────────────────────────

const aiFeatures: Flow = {
  topic: 'ai-features',
  async run(ctx) {
    const { page, t, demo } = ctx
    await aiFitOff(ctx) // leftovers from an interrupted run

    // Turning AI Fit Analysis on (Settings → Organization) — not saved.
    await ctx.goto('/settings/organization')
    const toggle = page.locator('#ai-fit-enabled')
    await toggle.waitFor()
    await toggle.click()
    const ack = page.locator('#ai-fit-ack')
    await ack.waitFor()
    await ack.check()
    const policy = cardOf(toggle)
    await ctx.shot('ai-fit-setting', {
      clip: policy,
      clipPad: 24,
      marks: [
        { target: page.locator('label[for="ai-fit-enabled"]').locator('xpath=..'), n: 1, badge: 'left' },
        { target: page.locator('label[for="ai-fit-ack"]'), n: 2, badge: 'left' },
      ],
    })

    // The analysis on a candidate's profile.
    await aiFitOnWithAnalyses(ctx)
    await ctx.goto(`/candidates/${await candidateId(ctx, 'c1')}`)
    const header = page.getByRole('button', { name: startsWith(t('aiFit.title')) }).filter({ visible: true }).first()
    await header.waitFor()
    await header.click()
    const card = header.locator('xpath=..')
    const agree = card.getByRole('button', { name: t('aiFit.agreeWithAi') })
    await agree.waitFor()
    await settle(page, 400)
    const section = (key: string) => card.getByText(t(key), { exact: true }).locator('xpath=..')
    await ctx.shot('ai-fit-card', {
      clip: card,
      clipPad: 24,
      marks: [
        { target: card.getByText(t('aiFit.meetsCriteria', { n: 2, m: 2 })), n: 1, badge: 'left' },
        { target: card.getByText(demo.engineerScorecard[0]!.label, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]/..'), n: 2, badge: 'left' },
        { target: section('aiFit.strengths'), n: 3, badge: 'left' },
        { target: section('aiFit.toVerify'), n: 3, badge: 'left' },
        { target: section('aiFit.suggestedQuestions'), n: 3, badge: 'left' },
        { target: agree.locator('xpath=ancestor::div[contains(@class,"border-t")][1]'), n: 4, badge: 'left' },
      ],
    })

    // Settings → AI oversight.
    await ctx.goto('/settings/ai-fit')
    const log = page.getByRole('heading', { name: t('aiFitPage.overrideLog') })
    await log.waitFor()
    await ctx.shot('ai-oversight', {
      fullPage: true,
      marks: [
        { target: page.getByText(t('aiFitPage.usedThisMonth'), { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'), n: 1, badge: 'left' },
        { target: page.locator('p.rounded-lg').filter({ hasText: /\d/ }).first(), n: 2, badge: 'left' },
        { target: log.locator('xpath=..'), n: 3, badge: 'left' },
      ],
    })

    // The inclusive-language check on a vacancy, with a sentence it should flag (not saved).
    // The check's answer is served from the demo data: a live model answer varies run to run.
    await page.route('**/api/ai/bias-check', (route) =>
      route.fulfill({ json: { ok: true, findings: demo.biasFindings.map((f) => ({ field: 'requirements', ...f })) } }),
    )
    await ctx.goto(`/vacancies/${await vacancyId(ctx, 'engineer')}/edit`)
    const requirements = page.locator('#requirements')
    await requirements.waitFor()
    await requirements.fill(`${await requirements.inputValue()}\n${demo.biasedSentence}`)
    const biasHeader = page.getByRole('button', { name: startsWith(t('aiBias.headerTitle')) })
    await biasHeader.click()
    const panel = biasHeader.locator('xpath=..')
    await panel.getByRole('button', { name: t('aiBias.runCheck') }).click()
    await panel.getByRole('button', { name: t('aiBias.reCheck') }).waitFor({ timeout: 120_000 })
    await settle(page, 600)
    await ctx.shot('ai-bias-check', { clip: panel, clipPad: 24 })
    await page.unroute('**/api/ai/bias-check')
  },
  cleanup: aiFitOff,
}

// ── Reports ─────────────────────────────────────────────────────────────────

const reports: Flow = {
  topic: 'reports',
  async run(ctx) {
    const { page, t } = ctx
    const statsOf = (key: string) =>
      page.getByText(t(key), { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"grid")][1]')
    const cardTitled = (key: string) =>
      cardOf(page.locator('[data-slot="card-title"]').filter({ hasText: t(key) }).first())

    await ctx.goto('/reports/pipeline?period=90d')
    await page.getByText(t('reports.funnel'), { exact: true }).waitFor()
    await settle(page, 600)
    await ctx.shot('reports-pipeline', {
      fullPage: true,
      marks: [
        // the report tabs (the sidebar has a "Pipeline" link too)
        { target: page.locator('a[href="/reports/pipeline"]').locator('xpath=..'), n: 1, badge: 'left' },
        { target: page.getByRole('combobox').first(), n: 2, badge: 'left' },
        { target: statsOf('reports.applications'), n: 3, badge: 'left' },
        { target: cardTitled('reports.funnel'), n: 4, badge: 'left' },
        { target: cardTitled('reports.stageToStage'), n: 5, badge: 'left' },
      ],
    })

    await ctx.goto('/reports/time-to-hire?period=90d')
    await page.getByText(t('reports.byVacancy'), { exact: true }).waitFor()
    await settle(page, 400)
    await ctx.shot('reports-time-to-hire', {
      fullPage: true,
      marks: [
        { target: statsOf('reports.hires'), n: 1, badge: 'left' },
        { target: cardTitled('reports.byVacancy'), n: 2, badge: 'left' },
      ],
    })

    await ctx.goto('/reports/sources?period=90d')
    await page.getByText(t('reports.sourcesWhereHires'), { exact: true }).waitFor()
    await settle(page, 400)
    await ctx.shot('reports-sources', {
      fullPage: true,
      marks: [
        { target: statsOf('reports.overallConversion'), n: 1, badge: 'left' },
        { target: cardTitled('reports.sourcesWhereHires'), n: 2, badge: 'left' },
      ],
    })
  },
}

export const AI_AND_REPORTS_FLOWS: Flow[] = [aiFeatures, reports]
