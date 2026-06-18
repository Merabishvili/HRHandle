'use client'

import { Briefcase } from 'lucide-react'

import type { BasicsState } from './step-basics'
import type { DatesCompState } from './step-dates-comp'
import type { DescriptionState } from './step-description'
import type { ScorecardState } from './step-scorecard'

interface StepReviewProps {
  basics: BasicsState
  datesComp: DatesCompState
  description: DescriptionState
  scorecard: ScorecardState
  sectors: { id: string; name: string }[]
}

/**
 * Wave 2.7 wizard — Step 5 / Review & publish per Create Vacancy
 * Steps.dc.html.
 *
 * Summary tile at the top, then three info tiles (Salary, Scorecard,
 * Description completeness), then the publish decision card. The
 * decision is also driven by the footer's "Publish now" — this card
 * surfaces the inline preference so the recruiter sees the implication
 * of either choice before committing.
 */
export function StepReview({
  basics,
  datesComp,
  description,
  scorecard,
  sectors,
}: StepReviewProps) {
  const sector = sectors.find((s) => s.id === basics.sectorId) ?? null
  const sectorName = sector?.name ?? null
  const employmentLabel = formatEmployment(basics.employmentType)
  const workModeLabel = formatWorkMode(basics.workMode)
  const subtitleParts = [
    basics.department,
    basics.location,
    workModeLabel,
    employmentLabel,
    `${basics.openingsCount} opening${basics.openingsCount === 1 ? '' : 's'}`,
    sectorName,
  ].filter(Boolean) as string[]

  const mustHaveCount = scorecard.attributes.filter((a) => a.mustHave).length
  const descriptionComplete = description.description.trim().length > 0

  return (
    <div className="max-w-[900px] rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-5">
      <header className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.93_0.05_250)]">
          <Briefcase className="h-5 w-5 text-[oklch(0.45_0.16_250)]" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-bold text-foreground">
            {basics.title || 'Untitled role'}
          </h2>
          {subtitleParts.length > 0 && (
            <p className="truncate text-[12.5px] text-muted-foreground">
              {subtitleParts.join(' · ')}
            </p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <SummaryTile label="Salary">
          {datesComp.salaryMin !== null || datesComp.salaryMax !== null ? (
            <span className="font-semibold text-foreground">
              {formatSalary(datesComp)}
            </span>
          ) : (
            <span className="font-semibold text-muted-foreground">Not specified</span>
          )}
        </SummaryTile>
        <SummaryTile label="Scorecard">
          {scorecard.attributes.length === 0 ? (
            <span className="font-semibold text-muted-foreground">Default set (4)</span>
          ) : (
            <span className="font-semibold text-foreground">
              {scorecard.attributes.length} {scorecard.attributes.length === 1 ? 'attribute' : 'attributes'}
              {mustHaveCount > 0 ? ` · ${mustHaveCount} must-have` : ''}
            </span>
          )}
        </SummaryTile>
        <SummaryTile label="Description">
          {descriptionComplete ? (
            <span className="font-semibold text-[oklch(0.42_0.14_150)]">✓ Complete</span>
          ) : (
            <span className="font-semibold text-[oklch(0.5_0.19_27)]">Add before publish</span>
          )}
        </SummaryTile>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)] px-3.5 py-3">
          <span
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
            style={{ background: 'oklch(0.55 0.18 250)' }}
            aria-hidden
          >
            <span className="text-[10px] font-bold text-white">✓</span>
          </span>
          <div>
            <p className="text-[13px] font-bold text-[oklch(0.2_0.16_250)]">Publish now</p>
            <p className="text-[11px] text-muted-foreground">
              Live + apply link generated
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-[10px] border border-[oklch(0.9_0.01_250)] px-3.5 py-3">
          <span
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[oklch(0.85_0.01_250)]"
            aria-hidden
          />
          <div>
            <p className="text-[13px] font-bold text-foreground/80">Save as draft</p>
            <p className="text-[11px] text-muted-foreground">
              Not visible, no apply link yet
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11.5px] text-muted-foreground">
        Use the footer to commit — &ldquo;Publish now&rdquo; goes live straight away; &ldquo;Save as draft&rdquo; keeps it private. You can flip either later from the vacancy&apos;s Settings tab.
      </p>
    </div>
  )
}

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[9px] border border-[oklch(0.93_0.01_250)] px-3 py-2.5 text-[12.5px]">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1">{children}</p>
    </div>
  )
}

function formatSalary(dc: DatesCompState): string {
  const { salaryMin, salaryMax, salaryCurrency } = dc
  const min = salaryMin !== null ? salaryMin.toLocaleString() : null
  const max = salaryMax !== null ? salaryMax.toLocaleString() : null
  if (min && max) return `${salaryCurrency} ${min}–${max}`
  if (min) return `${salaryCurrency} ${min}+`
  if (max) return `Up to ${salaryCurrency} ${max}`
  return 'Not specified'
}

function formatEmployment(value: BasicsState['employmentType']): string {
  switch (value) {
    case 'full_time': return 'Full-time'
    case 'part_time': return 'Part-time'
    case 'contract': return 'Contract'
    case 'internship': return 'Internship'
  }
}

function formatWorkMode(value: BasicsState['workMode']): string {
  switch (value) {
    case 'on_site': return 'On-site'
    case 'hybrid': return 'Hybrid'
    case 'remote': return 'Remote'
  }
}
