'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { createVacancy } from '@/lib/actions/vacancies'
import { WizardShell } from './wizard-shell'
import { StepBasics, type BasicsState } from './step-basics'
import { StepDatesComp, type DatesCompState } from './step-dates-comp'
import { StepDescription, type DescriptionState } from './step-description'
import { StepScorecard, type ScorecardState } from './step-scorecard'
import { StepReview } from './step-review'

interface VacancyCreateWizardProps {
  sectors: { id: string; name: string }[]
  statusOptions: {
    id: string
    name: string
    code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
  }[]
}

type StepId = 'basics' | 'dates-comp' | 'description' | 'scorecard' | 'review'

const STEPS = [
  { id: 'basics', number: 1, label: 'Basics' },
  { id: 'dates-comp', number: 2, label: 'Dates & compensation' },
  { id: 'description', number: 3, label: 'Description & AI' },
  { id: 'scorecard', number: 4, label: 'Scorecard & questions', tag: 'NEW · optional' },
  { id: 'review', number: 5, label: 'Review & publish' },
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
export function VacancyCreateWizard({ sectors, statusOptions }: VacancyCreateWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<StepId>('basics')
  const [pending, startTransition] = useTransition()

  const [basics, setBasics] = useState<BasicsState>({
    title: '',
    department: '',
    sectorId: null,
    location: '',
    workMode: 'on_site',
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
      toast.error('Fill in the position title to save.')
      setCurrentStep('basics')
      return
    }
    if (!description.description.trim() && publish) {
      toast.error('Add an "About the job" description before publishing.')
      setCurrentStep('description')
      return
    }

    startTransition(async () => {
      // Backfill defaults to keep the existing VacancyInput schema happy
      // until the deferred schema changes land (tech-debt.md §1).
      const todayYmd = new Date().toISOString().slice(0, 10)
      const targetStatusCode = publish ? 'open' : 'draft'
      const targetStatus = statusOptions.find((s) => s.code === targetStatusCode)

      const result = await createVacancy({
        title: basics.title.trim(),
        sector_id: basics.sectorId,
        status_id: targetStatus?.id ?? null,
        department: basics.department.trim() || null,
        location: basics.location.trim() || null,
        employment_type: basics.employmentType,
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
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(publish ? 'Vacancy published.' : 'Vacancy saved as draft.')
      router.push(`/vacancies/${result.data.id}`)
      router.refresh()
    })
  }

  const railHint = (
    <>
      Fill <strong className="text-foreground">Basics</strong> →{' '}
      <strong className="text-foreground">Save &amp; publish</strong>. Steps 2–5 take sensible defaults you can refine later.
    </>
  )

  return (
    <WizardShell
      title="Create vacancy"
      stepStatusLabel={`Step ${stepIdx + 1} of ${STEPS.length}`}
      steps={STEPS.map((s) => ({ ...s }))}
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
              ← Back
            </Button>
          )}

          {canPublishFromHere && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => submit(false)}
                disabled={pending}
                className="h-9 border-[oklch(0.88_0.01_250)]"
              >
                {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                Save as draft
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => submit(true)}
                disabled={pending}
                className="h-9 border-[oklch(0.88_0.04_145)] text-[oklch(0.36_0.13_150)] hover:bg-[oklch(0.96_0.04_155)]"
              >
                Save &amp; publish
              </Button>
            </>
          )}

          {!isLastStep ? (
            <Button
              type="button"
              size="sm"
              onClick={goNext}
              disabled={pending || (currentStep === 'basics' && !isBasicsComplete)}
              className="ml-auto h-9 gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
            >
              Next: {STEPS[stepIdx + 1]?.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => submit(true)}
              disabled={pending}
              className="ml-auto h-9 gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Publish now
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
        <StepDescription value={description} onChange={setDescription} />
      )}
      {currentStep === 'scorecard' && (
        <StepScorecard value={scorecard} onChange={setScorecard} />
      )}
      {currentStep === 'review' && (
        <StepReview
          basics={basics}
          datesComp={datesComp}
          description={description}
          scorecard={scorecard}
          sectors={sectors}
        />
      )}
    </WizardShell>
  )
}
