'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { createCandidate, findCandidateByEmail } from '@/lib/actions/candidates'
import {
  bulkCreateExperienceEntries,
  bulkCreateEducationEntries,
} from '@/lib/actions/candidate-background'
import { createNote } from '@/lib/actions/notes'
import { uploadDocument } from '@/lib/actions/documents'
import { WizardShell } from '@/components/vacancies/wizard/wizard-shell'
import { StepPathSelect, type EntryMode } from './step-path-select'
import { StepPersonal, type PersonalState } from './step-personal'
import {
  StepExperienceEducation,
  type BackgroundState,
} from './step-experience-education'
import { StepApplication, type ApplicationState } from './step-application'
import { StepReview } from './step-review'
import type {
  ParsedCVInput,
  ExperienceEntryInput,
  EducationEntryInput,
} from '@/lib/validations/candidate-background'
import type { ApplicationStatus } from '@/lib/types/application'

type StepId = 'path' | 'personal' | 'background' | 'application' | 'review'

interface CandidateCreateWizardProps {
  vacancies: { id: string; title: string }[]
  defaultVacancyId: string | null
  /** Ordered, non-terminal pipeline stages (hired/rejected/withdrawn excluded). */
  startingStages: { id: string; code: ApplicationStatus['code']; name: string }[]
}

const BLANK_PERSONAL: PersonalState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  location: '',
  timezone: '',
  salaryExpectation: '',
  noticePeriod: '',
  languages: '',
  linkedinUrl: '',
}

const BLANK_BACKGROUND: BackgroundState = { experience: [], education: [] }

/**
 * Wave 2.7 candidate creation wizard per Create Candidate Steps.dc.html.
 *
 * 5-step wizard (Path → Personal → Experience/Education → Application →
 * Notes) replacing the previous single-page form. Two NEW behaviours
 * baked in per the design:
 *
 *   - **Starting stage picker** — when a vacancy is selected, recruiter
 *     can drop a warm candidate directly into a later stage. Default is
 *     `applied` for parity with the old flow.
 *   - **Duplicate detection** — debounced server-side check on the
 *     personal email; shows a warning tile on Step 3 with a link into
 *     the existing candidate so the recruiter can merge instead of
 *     creating a near-duplicate.
 *
 * The "Save & add another" footer affordance resets the wizard back to
 * the path-selector for bulk sourcing sessions — recruiters can drop in
 * a batch of CVs without leaving the wizard.
 *
 * Submission order is intentional:
 *   1. createCandidate (with linked vacancy + starting-stage override →
 *      creates the application at the chosen stage from the start, so no
 *      spurious "applied → screening" audit row or transition email).
 *   2. bulkCreateExperienceEntries / bulkCreateEducationEntries
 *   3. If notes.initialNote: createNote.
 */
export function CandidateCreateWizard({
  vacancies,
  defaultVacancyId,
  startingStages,
}: CandidateCreateWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<StepId>('path')
  const [pending, startTransition] = useTransition()

  const [entryMode, setEntryMode] = useState<EntryMode | null>(null)
  const [personal, setPersonal] = useState<PersonalState>(BLANK_PERSONAL)
  const [background, setBackground] = useState<BackgroundState>(BLANK_BACKGROUND)
  const [application, setApplication] = useState<ApplicationState>({
    source: null,
    vacancyId: defaultVacancyId ?? null,
    startingStageCode: 'applied',
  })
  const [note, setNote] = useState('')

  const [cvFile, setCvFile] = useState<File | null>(null)
  const [parsedFromCv, setParsedFromCv] = useState(false)
  const [duplicate, setDuplicate] = useState<
    { candidateId: string; candidateName: string } | null
  >(null)

  const STEPS = useStepDefs(entryMode)
  const stepIdx = STEPS.findIndex((s) => s.id === currentStep)
  const isFirstStep = stepIdx === 0
  const isLastStep = stepIdx === STEPS.length - 1

  const isPersonalValid =
    personal.firstName.trim().length > 0 && personal.lastName.trim().length > 0

  // Debounced duplicate-email lookup. We fire the server action 400ms
  // after the user stops typing in the email field; if the email is
  // empty or malformed, the action returns { data: null } so the warning
  // tile stays hidden.
  const lastCheckedEmailRef = useRef<string>('')
  useEffect(() => {
    const trimmed = personal.email.trim().toLowerCase()
    if (trimmed === lastCheckedEmailRef.current) return
    const timer = setTimeout(() => {
      lastCheckedEmailRef.current = trimmed
      if (!trimmed) {
        setDuplicate(null)
        return
      }
      void findCandidateByEmail(trimmed).then((res) => {
        if (!res.success) return
        setDuplicate(res.data ?? null)
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [personal.email])

  const handleCvParsed = (parsed: ParsedCVInput, file: File) => {
    setCvFile(file)
    setParsedFromCv(true)
    // Step 1's CV banner already wrote the personal fields back via its
    // own onChange; we only need to surface the experience + education
    // rows here so Step 2 picks them up.
    const expRows: ExperienceEntryInput[] = (parsed.experience ?? [])
      .filter((e): e is typeof e & { company: string; title: string } =>
        Boolean(e.company && e.title),
      )
      .map((e) => ({
        company: e.company,
        title: e.title,
        start_date: e.start_date ?? null,
        end_date: e.end_date ?? null,
        is_current: Boolean(e.is_current),
        description: e.description ?? null,
      }))

    const eduRows: EducationEntryInput[] = (parsed.education ?? [])
      .filter((e): e is typeof e & { institution: string } => Boolean(e.institution))
      .map((e) => ({
        institution: e.institution,
        degree: e.degree ?? null,
        field_of_study: e.field_of_study ?? null,
        start_year: e.start_year ?? null,
        end_year: e.end_year ?? null,
        is_ongoing: Boolean(e.is_ongoing),
      }))

    setBackground((prev) => ({
      experience: [...expRows, ...prev.experience],
      education: [...eduRows, ...prev.education],
    }))
  }

  const handleCvCleared = () => {
    setCvFile(null)
    setParsedFromCv(false)
  }

  const goNext = () => {
    const next = STEPS[stepIdx + 1]
    if (next) setCurrentStep(next.id)
  }
  const goPrev = () => {
    const prev = STEPS[stepIdx - 1]
    if (prev) setCurrentStep(prev.id)
  }

  const resetForAnother = () => {
    setEntryMode(null)
    setPersonal(BLANK_PERSONAL)
    setBackground(BLANK_BACKGROUND)
    setApplication({
      source: null,
      vacancyId: defaultVacancyId ?? null,
      startingStageCode: 'applied',
    })
    setNote('')
    setCvFile(null)
    setParsedFromCv(false)
    setDuplicate(null)
    lastCheckedEmailRef.current = ''
    setCurrentStep('path')
  }

  const submit = (addAnother: boolean) => {
    if (!isPersonalValid) {
      toast.error('First name and last name are required.')
      setCurrentStep('personal')
      return
    }

    startTransition(async () => {
      // Resolve the starting-stage status id when a vacancy is linked and
      // the recruiter picked something other than `applied`. Passed into
      // createCandidate so the application row is inserted at the target
      // stage from the start.
      const startingStatusId =
        application.vacancyId && application.startingStageCode !== 'applied'
          ? startingStages.find((s) => s.code === application.startingStageCode)?.id ?? null
          : null

      const result = await createCandidate(
        {
          first_name: personal.firstName.trim(),
          last_name: personal.lastName.trim(),
          email: personal.email.trim() || null,
          phone: personal.phone.trim() || null,
          location: personal.location.trim() || null,
          timezone: personal.timezone.trim() || null,
          languages: personal.languages.trim()
            ? personal.languages.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          salary_expectation: personal.salaryExpectation.trim() || null,
          notice_period: personal.noticePeriod.trim() || null,
          linkedin_profile_url: personal.linkedinUrl.trim() || null,
          source: application.source ?? null,
        },
        application.vacancyId,
        startingStatusId,
      )

      if (!result.success) {
        toast.error(result.error)
        return
      }
      const candidateId = result.data.id

      // Persist the uploaded CV as a document so it appears under Documents on
      // the profile (it was only used for field prefill before, then dropped).
      if (cvFile) {
        const fd = new FormData()
        fd.append('file', cvFile)
        fd.append('document_type', 'cv')
        const upload = await uploadDocument(candidateId, fd)
        if (!upload.success) {
          console.error('[wizard] CV document upload failed:', upload.error)
          toast.warning('Candidate saved, but the CV file could not be attached.')
        }
      }

      // Background entries — server actions skip empty rows internally.
      if (background.experience.length > 0) {
        await bulkCreateExperienceEntries(candidateId, background.experience)
      }
      if (background.education.length > 0) {
        await bulkCreateEducationEntries(candidateId, background.education)
      }

      if (note.trim()) {
        await createNote(candidateId, note.trim())
      }

      if (addAnother) {
        toast.success('Candidate added. Start the next one.')
        resetForAnother()
        return
      }

      toast.success('Candidate added.')
      router.push(`/candidates/${candidateId}`)
      router.refresh()
    })
  }

  const railHint = (
    <>
      Adding a batch?{' '}
      <strong className="text-foreground">Save &amp; add another</strong> resets
      the form so you can keep going.
    </>
  )

  return (
    <WizardShell
      title="Add candidate"
      stepStatusLabel={`Step ${stepIdx + 1} of ${STEPS.length}`}
      steps={STEPS.map((s) => ({ ...s }))}
      currentStepId={currentStep}
      closeHref="/candidates"
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

          {isLastStep ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => submit(true)}
                disabled={pending || !isPersonalValid}
                className="ml-auto h-9 border-[oklch(0.88_0.01_250)]"
              >
                {pending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                Save &amp; add another
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => submit(false)}
                disabled={pending || !isPersonalValid}
                className="h-9 gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                Add candidate
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={goNext}
              disabled={
                pending ||
                (currentStep === 'path' && entryMode === null) ||
                (currentStep === 'personal' && !isPersonalValid)
              }
              className="ml-auto h-9 gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
            >
              Next: {STEPS[stepIdx + 1]?.label}{' '}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
        </>
      }
    >
      {currentStep === 'path' && (
        <StepPathSelect value={entryMode} onChange={setEntryMode} />
      )}
      {currentStep === 'personal' && (
        <StepPersonal
          value={personal}
          onChange={setPersonal}
          entryMode={entryMode ?? 'manual'}
          onCvParsed={handleCvParsed}
          cvFile={cvFile}
          onCvCleared={handleCvCleared}
        />
      )}
      {currentStep === 'background' && (
        <StepExperienceEducation
          value={background}
          onChange={setBackground}
          parsedFromCv={parsedFromCv}
        />
      )}
      {currentStep === 'application' && (
        <StepApplication
          value={application}
          onChange={setApplication}
          vacancies={vacancies}
          stages={startingStages.map((s) => ({ code: s.code, name: s.name }))}
          duplicate={duplicate}
          note={note}
          onNoteChange={setNote}
        />
      )}
      {currentStep === 'review' && (
        <StepReview
          personal={personal}
          application={application}
          background={background}
          note={note}
          vacancies={vacancies}
          stages={startingStages.map((s) => ({ code: s.code, name: s.name }))}
          onEditStep={setCurrentStep}
        />
      )}
    </WizardShell>
  )
}

/**
 * Step list. The Path tile shows a muted sub-label of the chosen entry mode
 * (Manual / AI prefill); the final Review step is where the candidate is
 * committed.
 */
function useStepDefs(entryMode: EntryMode | null) {
  const tagForPath = entryMode === 'cv' ? 'AI prefill' : entryMode === 'manual' ? 'Manual' : undefined
  return [
    { id: 'path' as const, number: 1, label: 'Choose path', tag: tagForPath },
    { id: 'personal' as const, number: 2, label: 'Personal' },
    { id: 'background' as const, number: 3, label: 'Experience & education' },
    { id: 'application' as const, number: 4, label: 'Application & notes' },
    { id: 'review' as const, number: 5, label: 'Review' },
  ]
}
