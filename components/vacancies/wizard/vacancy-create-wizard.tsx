'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { createVacancy } from '@/lib/actions/vacancies'
import { bulkCreateVacancyQuestions } from '@/lib/actions/evaluations'
import { bulkCreateScreeningQuestions } from '@/lib/actions/screening-questions'
import { WizardShell } from './wizard-shell'
import { StepBasics, type BasicsState } from './step-basics'
import { StepDatesComp, type DatesCompState } from './step-dates-comp'
import { StepDescription, type DescriptionState } from './step-description'
import {
  StepScorecard,
  type ScorecardState,
  type ScorecardScreeningQuestion,
} from './step-scorecard'
import { StepReview } from './step-review'
import type { KnockoutCondition } from '@/lib/screening-questions/knockout-condition'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'

/** Build the persisted passing condition from a wizard screening question. */
function toKnockoutCondition(q: ScorecardScreeningQuestion): KnockoutCondition | null {
  if (!q.knockout) return null
  if (q.answerType === 'yes_no') return { kind: 'yes_no', passingAnswer: q.passYesNo }
  if (q.answerType === 'number') {
    if (q.numberValue === null) return null
    return { kind: 'number', op: q.numberOp, value: q.numberValue, value2: q.numberValue2 }
  }
  if (q.answerType === 'select') return { kind: 'select', passingOptions: q.passOptions }
  return null
}

interface VacancyCreateWizardProps {
  sectors: { id: string; name: string }[]
  statusOptions: {
    id: string
    name: string
    code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
  }[]
  /** Org content languages — when >1, Step 3 shows per-language JD tabs (Slice 4). */
  orgLocales?: { default: Locale; enabled: Locale[] }
}

/** Per-locale JD text for the non-default languages (default is `description`). */
type BodyTranslations = Record<string, { description: string; responsibilities: string; requirements: string }>

type StepId = 'basics' | 'dates-comp' | 'description' | 'scorecard' | 'review'

const STEPS = [
  { id: 'basics', number: 1, labelKey: 'wizard.stepBasics' },
  { id: 'dates-comp', number: 2, labelKey: 'wizard.stepDates' },
  { id: 'description', number: 3, labelKey: 'wizard.stepDescription' },
  { id: 'scorecard', number: 4, labelKey: 'wizard.stepScorecard' },
  { id: 'review', number: 5, labelKey: 'wizard.stepReview' },
] as const

/**
 * Wave 2.7 vacancy creation wizard per Create Vacancy Steps.dc.html.
 *
 * 5-step wizard replacing the previous single-page form. State is held
 * locally in the wizard; the user can advance / go back freely, save as
 * draft from any step after Basics, or publish from any step after
 * Basics. Step 4 (Scorecard) is NEW and optional — the wizard ships
 * without persisting it yet (Wave 2.5 introduces the schema for
 * must-have flags + screening questions; tech-debt.md §2 tracks this).
 *
 * Key design changes baked in:
 *   - Status dropdown is gone — status is decided by Save as draft vs
 *     Save & publish, never hand-picked.
 *   - Sector is optional.
 *   - Start date is optional (defaults to today when submitting so the
 *     existing schema constraint isn't broken; deferred schema change
 *     in tech-debt.md §1).
 *   - Work mode (on-site / hybrid / remote) is NEW — captured client-
 *     side only for now; needs a vacancies.work_mode column to persist
 *     (tech-debt.md §1).
 */
export function VacancyCreateWizard({
  sectors,
  statusOptions,
  orgLocales = { default: DEFAULT_LOCALE, enabled: [DEFAULT_LOCALE] },
}: VacancyCreateWizardProps) {
  const t = useTranslations()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<StepId>('basics')
  const [pending, startTransition] = useTransition()

  // i18n Slice 4 — non-default-locale JD text (the default locale is authored in
  // the `description` state below). Seeded empty for each extra enabled locale.
  const extraLocales = orgLocales.enabled.filter((l) => l !== orgLocales.default)
  const [translations, setTranslations] = useState<BodyTranslations>(() =>
    Object.fromEntries(
      extraLocales.map((l) => [l, { description: '', responsibilities: '', requirements: '' }]),
    ),
  )
  // Step 5's single commit action follows this choice (radio in the review
  // body ⇄ the footer's primary button label). Default to Publish.
  const [publishChoice, setPublishChoice] = useState<'publish' | 'draft'>('publish')

  const [basics, setBasics] = useState<BasicsState>({
    title: '',
    department: '',
    sectorId: null,
    location: '',
    workMode: 'onsite',
    employmentType: 'full_time',
    openingsCount: 1,
    hiringManagerName: '',
  })

  const [datesComp, setDatesComp] = useState<DatesCompState>({
    startDate: null,
    endDate: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'USD',
  })

  const [description, setDescription] = useState<DescriptionState>({
    description: '',
    responsibilities: '',
    requirements: '',
    showOnPublicPage: false,
  })

  const [scorecard, setScorecard] = useState<ScorecardState>({
    attributes: [],
    screeningQuestions: [],
  })

  const stepIdx = STEPS.findIndex((s) => s.id === currentStep)
  const isFirstStep = stepIdx === 0
  const isLastStep = stepIdx === STEPS.length - 1
  const isBasicsComplete = basics.title.trim().length > 0
  const canPublishFromHere = isBasicsComplete && currentStep !== 'basics'

  const goNext = () => {
    const next = STEPS[stepIdx + 1]
    if (next) setCurrentStep(next.id)
  }
  const goPrev = () => {
    const prev = STEPS[stepIdx - 1]
    if (prev) setCurrentStep(prev.id)
  }

  const submit = (publish: boolean) => {
    if (!isBasicsComplete) {
      toast.error(t('wizard.toastFillTitle'))
      setCurrentStep('basics')
      return
    }
    if (!description.description.trim() && publish) {
      toast.error(t('wizard.toastAddAbout'))
      setCurrentStep('description')
      return
    }

    startTransition(async () => {
      // Backfill defaults to keep the existing VacancyInput schema happy
      // until the deferred schema changes land (tech-debt.md §1).
      const todayYmd = new Date().toISOString().slice(0, 10)
      const targetStatusCode = publish ? 'open' : 'draft'
      const targetStatus = statusOptions.find((s) => s.code === targetStatusCode)

      // i18n Slice 4 — assemble per-locale JD objects: the default locale from
      // the `description` state, other locales from `translations`. Empty
      // strings are omitted so pickLocale falls back cleanly to the legacy text.
      const buildI18n = (field: 'description' | 'responsibilities' | 'requirements') => {
        const out: Record<string, string> = {}
        const def = description[field].trim()
        if (def) out[orgLocales.default] = def
        for (const l of extraLocales) {
          const v = (translations[l]?.[field] ?? '').trim()
          if (v) out[l] = v
        }
        return out
      }
      const description_i18n = buildI18n('description')
      const responsibilities_i18n = buildI18n('responsibilities')
      const requirements_i18n = buildI18n('requirements')
      const posting_locales = [
        orgLocales.default,
        ...extraLocales.filter(
          (l) => description_i18n[l] || responsibilities_i18n[l] || requirements_i18n[l],
        ),
      ]

      const result = await createVacancy({
        title: basics.title.trim(),
        sector_id: basics.sectorId,
        status_id: targetStatus?.id ?? null,
        department: basics.department.trim() || null,
        location: basics.location.trim() || null,
        employment_type: basics.employmentType,
        work_mode: basics.workMode,
        hiring_manager_name: basics.hiringManagerName.trim() || null,
        salary_min: datesComp.salaryMin,
        salary_max: datesComp.salaryMax,
        salary_currency: datesComp.salaryCurrency,
        openings_count: basics.openingsCount,
        start_date: datesComp.startDate ?? todayYmd,
        end_date: datesComp.endDate,
        description: description.description.trim() || 'Tell candidates about the role.',
        responsibilities: description.responsibilities.trim() || null,
        requirements: description.requirements.trim() || null,
        show_on_public_page: publish ? description.showOnPublicPage : false,
        description_i18n,
        responsibilities_i18n,
        requirements_i18n,
        posting_locales,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      // Wave 2.5 Slice 1 — persist scorecard attributes captured in
      // Step 4 as score-type vacancy_questions with their must_have flags.
      if (scorecard.attributes.length > 0) {
        const attrEntries = scorecard.attributes
          .filter((a) => a.label.trim().length > 0)
          .map((a) => ({
            label: a.label,
            type: 'score' as const,
            mustHave: a.mustHave,
          }))
        if (attrEntries.length > 0) {
          await bulkCreateVacancyQuestions(result.data.id, attrEntries)
        }
      }

      // Persist Step 4 screening questions on vacancy_screening_questions.
      // Each knockout carries a passing condition (Yes/No answer, number
      // range, or select option subset) which the normalizer serialises into
      // knockout_answer; short_text can't be a knockout.
      if (scorecard.screeningQuestions.length > 0) {
        const screeningEntries = scorecard.screeningQuestions
          .filter((q) => q.label.trim().length > 0)
          .map((q) => ({
            label: q.label,
            answerType: q.answerType,
            knockout: q.knockout,
            options: q.options,
            knockoutCondition: toKnockoutCondition(q),
          }))
        if (screeningEntries.length > 0) {
          await bulkCreateScreeningQuestions(result.data.id, screeningEntries)
        }
      }

      toast.success(publish ? t('wizard.toastPublished') : t('wizard.toastSavedDraft'))
      router.push(`/vacancies/${result.data.id}`)
      router.refresh()
    })
  }

  const railHint = t('wizard.railHint')

  return (
    <WizardShell
      title={t('wizard.createVacancy')}
      stepStatusLabel={t('wizard.stepStatus', { current: stepIdx + 1, total: STEPS.length })}
      steps={STEPS.map((s) => ({ id: s.id, number: s.number, label: t(s.labelKey) }))}
      currentStepId={currentStep}
      closeHref="/vacancies"
      railHint={railHint}
      footer={
        <>
          {!isFirstStep && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={pending}
              className="h-9"
            >
              ← {t('common.back')}
            </Button>
          )}

          {/* Steps 2–4: a single "Save as draft" escape hatch. The final
              commit (publish or draft) happens only on Step 5. */}
          {canPublishFromHere && !isLastStep && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => submit(false)}
              disabled={pending}
              className="h-9"
            >
              {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {t('wizard.saveAsDraft')}
            </Button>
          )}

          {!isLastStep ? (
            <Button
              type="button"
              size="sm"
              onClick={goNext}
              disabled={pending || (currentStep === 'basics' && !isBasicsComplete)}
              className="ml-auto h-9 gap-1.5"
            >
              {STEPS[stepIdx + 1] ? t('wizard.next', { label: t(STEPS[stepIdx + 1]!.labelKey) }) : ''} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : (
            // Single commit on Step 5 — label follows the review-body radio.
            <Button
              type="button"
              size="sm"
              onClick={() => submit(publishChoice === 'publish')}
              disabled={pending}
              className="ml-auto h-9 gap-1.5"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {publishChoice === 'publish' ? t('wizard.publishNow') : t('wizard.saveAsDraft')}
            </Button>
          )}
        </>
      }
    >
      {currentStep === 'basics' && (
        <StepBasics value={basics} onChange={setBasics} sectors={sectors} />
      )}
      {currentStep === 'dates-comp' && (
        <StepDatesComp value={datesComp} onChange={setDatesComp} />
      )}
      {currentStep === 'description' && (
        <StepDescription
          value={description}
          onChange={setDescription}
          orgLocales={orgLocales}
          translations={translations}
          onTranslationChange={(locale, field, value) =>
            setTranslations((prev) => ({
              ...prev,
              [locale]: {
                ...(prev[locale] ?? { description: '', responsibilities: '', requirements: '' }),
                [field]: value,
              },
            }))
          }
          jdContext={{
            title: basics.title,
            department: basics.department || null,
            location: basics.location || null,
            employment_type: basics.employmentType,
            sector_name: sectors.find((s) => s.id === basics.sectorId)?.name ?? null,
          }}
        />
      )}
      {currentStep === 'scorecard' && (
        <StepScorecard
          value={scorecard}
          onChange={setScorecard}
          jdContext={{
            title: basics.title,
            department: basics.department || null,
            location: basics.location || null,
            employment_type: basics.employmentType,
            sector_name: sectors.find((s) => s.id === basics.sectorId)?.name ?? null,
            description: description.description || null,
            responsibilities: description.responsibilities || null,
            requirements: description.requirements || null,
          }}
        />
      )}
      {currentStep === 'review' && (
        <StepReview
          basics={basics}
          datesComp={datesComp}
          description={description}
          scorecard={scorecard}
          sectors={sectors}
          publishChoice={publishChoice}
          onPublishChoiceChange={setPublishChoice}
          onEditStep={(id) => setCurrentStep(id as StepId)}
        />
      )}
    </WizardShell>
  )
}
