'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { getStageStyle, STALE_SPINE, STALE_TEXT } from '@/lib/pipeline/stage-style'
import { timeInStage } from '@/lib/pipeline/time-in-stage'

export type CardDensity = 'comfortable' | 'compact'

export interface CrossVacancyCardData {
  applicationId: string
  candidateId: string
  firstName: string
  lastName: string
  vacancyTitle: string
  /** Existing job title from the candidate's CV — shown as the subtitle
   * (current role, not the role they're applying for). */
  currentPosition: string | null
  /** Short source label ("LinkedIn", "Apply link", "Referral", "Manual").
   * Threaded through from candidates.source; mapped server-side to the
   * short form. Null when the recruiter didn't set it. */
  source: string | null
  /** Timestamp the card is "in this stage since" — applied_at for fresh
   * applications, last_status_changed_at for moved ones. */
  inStageSince: string
  /** Code of the stage the card sits in. Drives the spine color. */
  stageCode: string
  /** 0–10 fit score from the most recent candidate_evaluation. Only
   * rendered in compact density. Null shows as "—". */
  fitScore: number | null
}

interface CrossVacancyCardProps {
  data: CrossVacancyCardData
  density: CardDensity
  selected: boolean
  onToggleSelect: (id: string, next: boolean) => void
  /** Show the selection checkbox. The bulk bar controls this — checkboxes
   * appear only when bulk-select mode is active. */
  selectMode: boolean
}

/** Avatar background hue, deterministic per first letter. The design
 * varies avatar tints between candidates to make scanning easier; we don't
 * need cryptographic randomness, just stable variation across the list. */
const AVATAR_HUES = [
  { bg: 'oklch(0.93 0.04 250)', text: 'oklch(0.45 0.16 250)' },
  { bg: 'oklch(0.94 0.05 165)', text: 'oklch(0.4 0.1 165)' },
  { bg: 'oklch(0.95 0.06 95)', text: 'oklch(0.45 0.1 80)' },
  { bg: 'oklch(0.93 0.06 300)', text: 'oklch(0.45 0.15 300)' },
  { bg: 'oklch(0.94 0.05 210)', text: 'oklch(0.42 0.12 210)' },
]

function avatarStyle(seed: string): { background: string; color: string } {
  const code = seed.charCodeAt(0) || 0
  // AVATAR_HUES.length is the divisor, so the index is always in range —
  // the non-null assertion keeps TS happy without an extra runtime guard.
  const hue = AVATAR_HUES[code % AVATAR_HUES.length]!
  return { background: hue.bg, color: hue.text }
}

function fitScoreStyle(score: number | null): { className: string; label: string } {
  if (score === null) return { className: 'bg-muted text-muted-foreground', label: '—' }
  if (score >= 7) {
    return {
      className: 'bg-[oklch(0.93_0.07_155)] text-[oklch(0.38_0.14_150)]',
      label: score.toFixed(1),
    }
  }
  if (score >= 5) {
    return {
      className: 'bg-[oklch(0.95_0.08_95)] text-[oklch(0.45_0.11_80)]',
      label: score.toFixed(1),
    }
  }
  return {
    className: 'bg-[oklch(0.95_0.04_25)] text-[oklch(0.5_0.18_25)]',
    label: score.toFixed(1),
  }
}

export function CrossVacancyCard({
  data,
  density,
  selected,
  onToggleSelect,
  selectMode,
}: CrossVacancyCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: data.applicationId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const stageStyle = getStageStyle(data.stageCode)
  const time = timeInStage(data.inStageSince)
  const spine = time.isStale ? STALE_SPINE : stageStyle.spine

  const initials = `${data.firstName[0] ?? ''}${data.lastName[0] ?? ''}`.toUpperCase()
  const avatar = avatarStyle(data.firstName)

  const timeLabel = time.isStale
    ? `${time.label} · stale`
    : data.source
      ? `${time.label} · ${data.source}`
      : `${time.label} in stage`

  if (density === 'compact') {
    const fit = fitScoreStyle(data.fitScore)
    return (
      <div ref={setNodeRef} style={style}>
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 shadow-sm transition-colors',
            selected ? 'border-primary/60 ring-2 ring-primary/20' : 'border-border',
          )}
          style={{ borderLeft: `3px solid ${spine}` }}
        >
          {selectMode && (
            <Checkbox
              checked={selected}
              onCheckedChange={(v) => onToggleSelect(data.applicationId, v === true)}
              aria-label={`Select ${data.firstName} ${data.lastName}`}
            />
          )}
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag candidate"
            className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
            style={{ background: avatar.background, color: avatar.color }}
          >
            <span className="text-[10px] font-bold">{initials}</span>
          </button>
          <div className="min-w-0 flex-1">
            <Link
              href={`/candidates/${data.candidateId}`}
              className="block truncate text-[12.5px] font-semibold text-foreground hover:underline"
            >
              {data.firstName} {data.lastName}
            </Link>
            <p
              className="truncate text-[11px]"
              style={{ color: time.isStale ? STALE_TEXT : undefined }}
            >
              <span className="text-muted-foreground">{data.currentPosition ?? data.vacancyTitle}</span>
              {' · '}
              <span style={{ color: time.isStale ? STALE_TEXT : undefined }}>{time.label}{time.isStale ? ' stale' : ''}</span>
            </p>
          </div>
          <span
            className={cn(
              'inline-flex h-[22px] w-[34px] shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums',
              fit.className,
            )}
            aria-label={`Fit score ${fit.label}`}
          >
            {fit.label}
          </span>
        </div>
      </div>
    )
  }

  // Comfortable layout — Version B
  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'rounded-lg border bg-card p-3 shadow-sm transition-colors',
          selected ? 'border-primary/60 ring-2 ring-primary/20' : 'border-border',
        )}
        style={{ borderLeft: `3px solid ${spine}` }}
      >
        <div className="mb-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="truncate">{data.vacancyTitle}</span>
        </div>

        <div className="flex items-start gap-2">
          {selectMode && (
            <Checkbox
              checked={selected}
              onCheckedChange={(v) => onToggleSelect(data.applicationId, v === true)}
              aria-label={`Select ${data.firstName} ${data.lastName}`}
              className="mt-1"
            />
          )}
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag candidate"
            className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-full text-[11px] font-bold active:cursor-grabbing"
            style={{ background: avatar.background, color: avatar.color }}
          >
            {initials}
          </button>
          <div className="min-w-0 flex-1">
            <Link
              href={`/candidates/${data.candidateId}`}
              className="block truncate text-[13px] font-semibold text-foreground hover:underline"
            >
              {data.firstName} {data.lastName}
            </Link>
            {data.currentPosition && (
              <p className="truncate text-[11.5px] text-muted-foreground">{data.currentPosition}</p>
            )}
          </div>
        </div>

        <p
          className="mt-1.5 text-[11.5px]"
          style={{
            color: time.isStale ? STALE_TEXT : undefined,
            fontWeight: time.isStale ? 600 : undefined,
          }}
        >
          {time.isStale ? (
            <>
              <span
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: STALE_SPINE }}
                aria-hidden
              />
              {timeLabel}
            </>
          ) : (
            <span className="text-muted-foreground">{timeLabel}</span>
          )}
        </p>
      </div>
    </div>
  )
}
