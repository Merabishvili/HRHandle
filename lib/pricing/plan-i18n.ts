import type { PricingPlan } from '@/lib/types/subscription'

type Translator = (key: string, values?: Record<string, string | number>) => string

/** Localized plan name (Trial / Individual / Corporate) by plan code. */
export function planName(t: Translator, code: string): string {
  return t(`planCards.name.${code}`)
}

/**
 * Localized feature bullets for a plan, rebuilt from the plan's structured
 * limits + a per-code capability list — the English `plan.features[]` array is
 * ignored for display so nothing needs string-matching. Numbers format per
 * locale via ICU `{count, number}`.
 */
export function planFeatures(t: Translator, plan: PricingPlan): string[] {
  const limits = [
    t('planFeat.vacancies', { count: plan.vacancy_limit }),
    t('planFeat.candidates', { count: plan.candidate_limit }),
    t('planFeat.teamMembers', { count: plan.member_limit }),
  ]

  if (plan.code === 'trial') {
    return [t('planFeat.freeTrial'), ...limits, t('planFeat.basicAts')]
  }

  const shared = [
    ...limits,
    t('planFeat.fullTracking'),
    t('planFeat.interviewScheduling'),
    t('planFeat.advancedFiltering'),
  ]

  if (plan.code === 'organization') {
    return [...shared, t('planFeat.teamCollaboration')]
  }

  return shared
}
