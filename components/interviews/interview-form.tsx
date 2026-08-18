'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { createInterview } from '@/lib/actions/interviews'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
// Select kept for the Duration dropdown.
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DatePicker } from '@/components/ui/date-picker'
import { nextBusinessSlot } from '@/lib/interviews/default-time'
import { Calendar, Loader2, MapPin, Phone, Video } from 'lucide-react'
import type { InterviewType } from '@/lib/types'
import {
  getCandidateFullName,
  defaultMeetingOption,
  type InterviewFormProps,
} from './interview-form-helpers'
import {
  EmailToggle,
  TypeSegment,
  LockedField,
  MeetChip,
  SummaryRow,
} from './interview-form-parts'

const durationOptions = [
  { value: 30, labelKey: 'interviews.dur30m' },
  { value: 45, labelKey: 'interviews.dur45m' },
  { value: 60, labelKey: 'interviews.dur1h' },
  { value: 90, labelKey: 'interviews.dur90m' },
  { value: 120, labelKey: 'interviews.dur2h' },
]

export function InterviewForm({
  candidates,
  vacancies,
  applications,
  teamMembers,
  defaultCandidateId,
  defaultVacancyId,
  defaultApplicationId,
  defaultInterviewerId,
  hasGoogleCalendar = false,
  hasZoom = false,
  hasMicrosoft = false,
  defaultMeetingProvider = null,
  onScheduled,
  onCancel,
}: InterviewFormProps) {
  const t = useTranslations()
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Candidate-first flow: the page was opened from a specific candidate, so
  // the candidate is locked and the vacancy is derived from their application.
  const candidateFirst = !!defaultCandidateId
  const initialApps = applications.filter((a) => a.candidate_id === (defaultCandidateId || ''))
  const derivedVacancyId =
    defaultVacancyId || (initialApps.length === 1 ? initialApps[0]!.vacancy_id : '')
  const derivedApplicationId =
    defaultApplicationId || (initialApps.length === 1 ? initialApps[0]!.id : '')

  const [candidateId, setCandidateId] = useState(defaultCandidateId || '')
  const [vacancyId, setVacancyId] = useState(derivedVacancyId)
  const [applicationId, setApplicationId] = useState(derivedApplicationId)
  // Default the interviewer to the current user (a team member) so an
  // interview is never left implicitly unassigned — and never the candidate.
  const [interviewerId, setInterviewerId] = useState(defaultInterviewerId || '')
  // Default date + time to the next business-day slot (a real future weekday
  // time), not an empty date or the arbitrary current minute.
  const [initialSlot] = useState(nextBusinessSlot)
  const [scheduledDate, setScheduledDate] = useState(initialSlot.date)
  const [scheduledTime, setScheduledTime] = useState(initialSlot.time)
  const [duration, setDuration] = useState(60)
  const [type, setType] = useState<InterviewType>('video')

  // Meeting options: prefer an auto link when a calendar is connected (#5).
  const [meetingOption, setMeetingOption] = useState<'manual' | 'google_meet' | 'zoom' | 'teams'>(
    () => defaultMeetingOption(hasGoogleCalendar, hasZoom, hasMicrosoft, defaultMeetingProvider),
  )
  const [manualMeetingLink, setManualMeetingLink] = useState('')
  const [sendInvitation, setSendInvitation] = useState(false)

  const candidateApplications = useMemo(() => {
    if (!candidateId) return []
    return applications.filter((a) => a.candidate_id === candidateId)
  }, [applications, candidateId])

  const availableVacancies = useMemo(() => {
    if (!candidateId) return vacancies
    const vacancyIds = new Set(candidateApplications.map((a) => a.vacancy_id))
    return vacancies.filter((v) => vacancyIds.has(v.id))
  }, [candidateApplications, candidateId, vacancies])

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.id === candidateId) ?? null,
    [candidates, candidateId]
  )

  const candidateHasEmail = !!selectedCandidate?.email

  // The interviewer is always a team member, never the candidate. Candidates
  // aren't in `teamMembers` to begin with; this also drops an internal
  // applicant (a team member whose email matches the selected candidate) so
  // you can't pick the interviewee as their own interviewer (#1).
  const interviewerMembers = useMemo(() => {
    const candEmail = selectedCandidate?.email?.trim().toLowerCase()
    if (!candEmail) return teamMembers
    return teamMembers.filter((m) => (m.email ?? '').trim().toLowerCase() !== candEmail)
  }, [teamMembers, selectedCandidate])

  // Lock the vacancy (show it read-only) when we arrived from a candidate and
  // there's a single role to interview for — no redundant picker (#3).
  const lockVacancy = candidateFirst && !!vacancyId && availableVacancies.length <= 1

  const handleCandidateChange = (id: string) => {
    setCandidateId(id)
    const related = applications.filter((a) => a.candidate_id === id)
    if (related.length === 1 && related[0]) {
      setApplicationId(related[0].id)
      setVacancyId(related[0].vacancy_id)
    } else {
      setApplicationId('')
      setVacancyId('')
    }
  }

  const handleVacancyChange = (id: string) => {
    setVacancyId(id)
    if (!candidateId) { setApplicationId(''); return }
    const matched = applications.find((a) => a.candidate_id === candidateId && a.vacancy_id === id)
    setApplicationId(matched?.id || '')
  }

  const handleInterviewerChange = (value: string) => {
    setInterviewerId(value === 'none' ? '' : value)
  }

  const handleTypeChange = (value: string) => {
    setType(value as InterviewType)
    if (value !== 'video') setMeetingOption('manual')
  }

  const validateForm = (): string | null => {
    if (!candidateId) return t('interviews.form.errCandidate')
    if (!vacancyId) return t('interviews.form.errVacancy')
    if (!scheduledDate) return t('interviews.form.errDate')
    if (!scheduledTime) return t('interviews.form.errTime')

    const matched = applications.find(
      (a) => a.candidate_id === candidateId && a.vacancy_id === vacancyId
    )
    if (!matched) return t('interviews.form.errNotInVacancy')

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)
    if (Number.isNaN(scheduledAt.getTime())) return t('interviews.form.errInvalidDateTime')
    if (scheduledAt < new Date()) return t('interviews.form.errFuture')

    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const validationError = validateForm()
    if (validationError) { setError(validationError); return }

    setIsLoading(true)

    const matched = applications.find(
      (a) => a.candidate_id === candidateId && a.vacancy_id === vacancyId
    )
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)

    const result = await createInterview(
      {
        candidate_id: candidateId,
        vacancy_id: vacancyId,
        application_id: applicationId || matched?.id || null,
        interviewer_id: interviewerId || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: duration,
        type,
      },
      {
        createMeet: meetingOption === 'google_meet',
        createZoom: meetingOption === 'zoom',
        createTeams: meetingOption === 'teams',
        meetingLink: meetingOption === 'manual' ? manualMeetingLink || null : null,
        sendInvitation,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    )

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    const w = result.data.warnings
    // meet_creation_failed is the most actionable warning (user can reconnect
    // Google to fix), so surface it on its own when present. Otherwise combine
    // email + notification warnings.
    if (w.includes('meet_creation_failed')) {
      toast.warning(t('interviews.form.toastMeetFailed'))
    } else if (w.includes('email_failed') && w.includes('notification_failed')) {
      toast.warning(t('interviews.form.toastEmailNotifFailed'))
    } else if (w.includes('email_failed')) {
      toast.warning(t('interviews.form.toastEmailFailed'))
    } else if (w.includes('notification_failed')) {
      toast.warning(t('interviews.form.toastNotifFailed'))
    } else {
      toast.success(t('interviews.form.toastScheduled'))
    }

    // Overlay callers (Review Mode) stay in place and refresh their own data;
    // the standalone page navigates back to the interviews list.
    if (onScheduled) {
      onScheduled()
    } else {
      router.push('/interviews')
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleCancel = () => (onCancel ? onCancel() : router.push('/interviews'))

  const showAutoMeetOptions = type === 'video' && (hasGoogleCalendar || hasZoom)
  const selectedVacancyTitle = vacancies.find((v) => v.id === vacancyId)?.title ?? null
  const selectedInterviewerName =
    teamMembers.find((m) => m.id === interviewerId)?.full_name ?? null
  const meetingTypeSummary =
    meetingOption === 'google_meet' ? t('interviews.form.sumVideoMeet')
    : meetingOption === 'zoom' ? t('interviews.form.sumVideoZoom')
    : meetingOption === 'teams' ? t('interviews.form.sumVideoTeams')
    : type === 'video' ? t('interviews.form.sumVideo')
    : type === 'phone' ? t('interviews.form.sumPhone')
    : t('interviews.form.sumOnsite')

  // Live When-summary string from the date/time inputs. Defensive: if
  // either is missing, we show '—' so the rail card never lies about a
  // partial selection.
  const summaryWhen = (() => {
    if (!scheduledDate || !scheduledTime) return '—'
    const dt = new Date(`${scheduledDate}T${scheduledTime}`)
    if (Number.isNaN(dt.getTime())) return '—'
    return dt.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  })()

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Capped, centered two-column grid — the form column gets ~1.6x the
          width of the content-sized summary column (which sits at the top,
          not stretched to full height). Collapses to a single column below
          lg, where the summary is replaced by a sticky footer recap. */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* ── FORM CARD ── */}
        <div className="flex flex-col gap-[18px] rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="candidate">{t('interviews.form.candidate')} *</Label>
            {candidateFirst && selectedCandidate ? (
              <LockedField
                value={getCandidateFullName(selectedCandidate)}
                hint={selectedCandidate.email ?? undefined}
              />
            ) : (
              <SearchableSelect
                id="candidate"
                value={candidateId}
                onValueChange={handleCandidateChange}
                disabled={isLoading}
                placeholder={t('interviews.form.selectCandidate')}
                searchPlaceholder={t('interviews.form.searchCandidates')}
                emptyText={t('interviews.form.noCandidates')}
                options={candidates.map((c) => ({
                  value: c.id,
                  label: getCandidateFullName(c),
                  // Keep the raw stored name in the search text too, so typing
                  // the ALL-CAPS form still matches the title-cased label.
                  searchText: `${c.first_name} ${c.last_name} ${getCandidateFullName(c)} ${c.email ?? ''}`,
                  description: c.email ?? undefined,
                }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="vacancy">{t('interviews.form.vacancy')} *</Label>
            {lockVacancy ? (
              <LockedField value={selectedVacancyTitle ?? t('interviews.form.derivedFromCandidate')} />
            ) : (
              <>
                <SearchableSelect
                  id="vacancy"
                  value={vacancyId}
                  onValueChange={handleVacancyChange}
                  disabled={isLoading || !candidateId}
                  placeholder={candidateId ? t('interviews.form.selectVacancy') : t('interviews.form.selectCandidateFirst')}
                  searchPlaceholder={t('interviews.form.searchVacancies')}
                  emptyText={t('interviews.form.noVacancies')}
                  options={availableVacancies.map((v) => ({
                    value: v.id,
                    label: v.title,
                    searchText: v.title,
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  {t('interviews.form.onlyConsidered')}
                </p>
              </>
            )}
          </div>

          {/* Type — segmented control; shares the exact 3-col grid as
              Date/Time/Duration below so the rhythm lines up. On mobile the
              tiles stack icon-over-label to stay compact. */}
          <div className="space-y-2">
            <Label>{t('interviews.form.type')}</Label>
            <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label={t('interviews.form.type')}>
              <TypeSegment
                active={type === 'video'}
                icon={Video}
                label={t('interviews.form.typeVideo')}
                onClick={() => handleTypeChange('video')}
                disabled={isLoading}
              />
              <TypeSegment
                active={type === 'phone'}
                icon={Phone}
                label={t('interviews.form.typePhone')}
                onClick={() => handleTypeChange('phone')}
                disabled={isLoading}
              />
              <TypeSegment
                active={type === 'onsite'}
                icon={MapPin}
                label={t('interviews.form.typeOnsite')}
                onClick={() => handleTypeChange('onsite')}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Date / Time / Duration — even 3-col on sm+; Date + Time pair up
              and Duration drops full-width on the narrowest screens. */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t('interviews.date')} *</Label>
              <DatePicker
                value={scheduledDate || null}
                onChange={(v) => setScheduledDate(v ?? '')}
                placeholder={t('interviews.form.pickDate')}
                disabled={isLoading}
                disablePast
                fromYear={new Date().getFullYear()}
                toYear={new Date().getFullYear() + 3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">{t('interviews.time')} *</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledTime(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="col-span-2 space-y-2 sm:col-span-1">
              <Label htmlFor="duration">{t('interviews.duration')}</Label>
              <Select
                value={duration.toString()}
                onValueChange={(v) => setDuration(parseInt(v, 10))}
                disabled={isLoading}
              >
                <SelectTrigger id="duration"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {durationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value.toString()}>{t(o.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interviewer">{t('interviews.form.interviewer')}</Label>
            <SearchableSelect
              id="interviewer"
              value={interviewerId || 'none'}
              onValueChange={handleInterviewerChange}
              disabled={isLoading}
              placeholder={t('interviews.form.selectInterviewer')}
              searchPlaceholder={t('interviews.form.searchTeam')}
              emptyText={t('interviews.form.noTeam')}
              options={[
                { value: 'none', label: t('interviews.notAssigned') },
                ...interviewerMembers.map((m) => ({
                  value: m.id,
                  label: m.full_name,
                  searchText: m.full_name,
                })),
              ]}
            />
          </div>

          {/* Manual meeting-link fallback when no calendar integration */}
          {(!showAutoMeetOptions || meetingOption === 'manual') && type === 'video' && (
            <div className="space-y-2">
              <Label htmlFor="meeting-link">{t('interviews.form.meetingLink')}</Label>
              <Input
                id="meeting-link"
                type="url"
                placeholder={t('interviews.form.meetingLinkPlaceholder')}
                value={manualMeetingLink}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualMeetingLink(e.target.value)}
                disabled={isLoading}
                maxLength={2000}
              />
            </div>
          )}

          {/* Calendar integration callout — meeting-related, so it lives with
              the fields rather than in the content-sized summary card. */}
          {type === 'video' && hasGoogleCalendar && (
            <div
              className="rounded-[11px] border p-3.5"
              style={{ borderColor: 'oklch(0.86 0.06 145)', background: 'oklch(0.985 0.02 150)' }}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" style={{ color: 'oklch(0.42 0.14 150)' }} aria-hidden />
                <p className="text-[13px] font-bold" style={{ color: 'oklch(0.32 0.13 150)' }}>
                  {t('interviews.form.gcalConnected')}
                </p>
              </div>
              <p className="text-[12px] leading-[1.5]" style={{ color: 'oklch(0.4 0.06 150)' }}>
                {t('interviews.form.gcalHint')}
              </p>
            </div>
          )}

          {/* Meeting-option chips (only when there's something to choose between) */}
          {showAutoMeetOptions && (
            <div className="flex flex-wrap gap-1.5">
              {hasGoogleCalendar && (
                <MeetChip active={meetingOption === 'google_meet'} label={t('interviews.form.autoMeet')} onClick={() => setMeetingOption('google_meet')} disabled={isLoading} />
              )}
              {hasZoom && (
                <MeetChip active={meetingOption === 'zoom'} label={t('interviews.form.autoZoom')} onClick={() => setMeetingOption('zoom')} disabled={isLoading} />
              )}
              {hasMicrosoft && (
                <MeetChip active={meetingOption === 'teams'} label={t('interviews.form.autoTeams')} onClick={() => setMeetingOption('teams')} disabled={isLoading} />
              )}
              <MeetChip active={meetingOption === 'manual'} label={t('interviews.form.manual')} onClick={() => setMeetingOption('manual')} disabled={isLoading} />
            </div>
          )}
        </div>

        {/* ── SUMMARY CARD (desktop) — content-sized, top-aligned ── */}
        <aside className="hidden self-start rounded-2xl border border-border bg-[oklch(0.985_0.002_247)] p-5 sm:p-6 lg:flex lg:flex-col lg:gap-3.5">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t('interviews.form.summary')}
          </p>
          <ul className="flex flex-col gap-2 text-[13px]">
            <SummaryRow label={t('interviews.form.candidate')} value={selectedCandidate ? getCandidateFullName(selectedCandidate) : '—'} />
            <SummaryRow label={t('interviews.form.role')} value={selectedVacancyTitle ?? '—'} />
            <SummaryRow label={t('interviews.form.when')} value={summaryWhen} />
            <SummaryRow label={t('interviews.duration')} value={t('interviews.form.minutes', { count: duration })} />
            <SummaryRow label={t('interviews.form.typeLabel')} value={meetingTypeSummary} />
            <SummaryRow label={t('interviews.form.interviewer')} value={selectedInterviewerName ?? t('interviews.notAssigned')} />
          </ul>

          <div className="border-t border-border pt-3.5">
            <EmailToggle
              id="send-invitation"
              checked={sendInvitation}
              onChange={setSendInvitation}
              disabled={isLoading}
              candidateHasEmail={candidateHasEmail}
              showNoEmailHint={!candidateHasEmail && !!candidateId}
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1 gap-1.5">
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('interviews.form.scheduling')}
                </>
              ) : (
                t('interviews.form.schedule')
              )}
            </Button>
          </div>
        </aside>
      </div>

      {/* ── STICKY FOOTER (mobile) — one-line recap + actions, always in
          thumb-reach without repeating the six summary fields ── */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-border bg-[oklch(0.985_0.002_247)] px-4 py-3 lg:hidden">
        <EmailToggle
          id="send-invitation-mobile"
          checked={sendInvitation}
          onChange={setSendInvitation}
          disabled={isLoading}
          candidateHasEmail={candidateHasEmail}
          showNoEmailHint={false}
          className="mb-2"
        />
        <p className="mb-2 text-[12.5px] text-muted-foreground">
          {summaryWhen} · {duration} min · {meetingTypeSummary}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isLoading} className="flex-[1.4] gap-1.5">
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('interviews.form.scheduling')}
              </>
            ) : (
              t('interviews.form.schedule')
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** Email-candidate checkbox row — reused by the desktop summary card and the
 * mobile sticky footer (distinct ids so both can coexist, bound to the same
 * state). Disabled + dimmed when the candidate has no email on file. */
