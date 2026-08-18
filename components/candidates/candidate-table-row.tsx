import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CandidateStatusActions } from '@/components/candidates/candidate-status-actions'
import { CandidateOptionalCell } from '@/components/candidates/candidate-optional-cell'
import { CANDIDATE_GENERAL_STATUS_COLORS } from '@/lib/types/candidate'
import { toDisplayFullName } from '@/lib/format-name'
import {
  getVacancyTitle,
  type ApplicationRow,
  type CandidateRow,
  type DerivedStage,
  type VacancyOption,
} from '@/lib/candidates/list-derivation'
import type { CandidateStatusOption } from '@/lib/types/database'

interface CandidateTableRowProps {
  candidate: CandidateRow
  applications: ApplicationRow[]
  vacancyMap: Map<string, VacancyOption>
  status: CandidateStatusOption | null
  activeColumns: string[]
  stage?: DerivedStage | undefined
  fit?: number | undefined
  customFieldValueMap: Map<string, string>
}

/**
 * One row of the Candidates list. Extracted from `candidates/page.tsx`
 * (A-002). Renders the fixed columns (name / status / linked vacancy), the
 * active optional columns via <CandidateOptionalCell>, and the row actions.
 */
export async function CandidateTableRow({
  candidate,
  applications,
  vacancyMap,
  status,
  activeColumns,
  stage,
  fit,
  customFieldValueMap,
}: CandidateTableRowProps) {
  const t = await getTranslations()
  // Display casing only — some records are stored ALL-CAPS (CV/import). The
  // stored value is untouched; see lib/format-name.
  const fullName = toDisplayFullName(candidate.first_name, candidate.last_name)
  const initials =
    `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase()

  const firstApp = applications[0]
  const firstVacancyTitle = firstApp
    ? (getVacancyTitle(firstApp) ?? vacancyMap.get(firstApp.vacancy_id)?.title ?? null)
    : null
  const extraCount = applications.length > 1 ? applications.length - 1 : 0

  return (
    <TableRow>
      {/* Candidate name */}
      <TableCell>
        <Link
          href={`/candidates/${candidate.id}`}
          className="flex items-center gap-3 hover:underline"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <span className="text-sm font-medium text-primary">{initials}</span>
          </div>
          <div>
            <p className="font-medium text-foreground">{fullName}</p>
            {candidate.source && (
              <p className="text-xs text-muted-foreground">{t('candTable.via', { source: candidate.source })}</p>
            )}
          </div>
        </Link>
      </TableCell>

      {/* Status */}
      <TableCell>
        {status ? (
          <Badge
            variant="secondary"
            className={CANDIDATE_GENERAL_STATUS_COLORS[status.code]}
          >
            {t.has(`candStatus.${status.code}`) ? t(`candStatus.${status.code}`) : status.name}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">{t('candTable.notSet')}</span>
        )}
      </TableCell>

      {/* Linked vacancy */}
      <TableCell>
        {applications.length > 0 ? (
          <div className="space-y-0.5">
            <p className="text-sm text-foreground">{firstVacancyTitle || t('interviews.unknownVacancy')}</p>
            {extraCount > 0 && (
              <p className="text-xs text-muted-foreground">{t('candTable.moreCount', { count: extraCount })}</p>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{t('billing.notLinked')}</span>
        )}
      </TableCell>

      {/* Optional columns */}
      {activeColumns.map((col) => (
        <CandidateOptionalCell
          key={col}
          col={col}
          candidate={candidate}
          stage={stage}
          fit={fit}
          customFieldValueMap={customFieldValueMap}
        />
      ))}

      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('candTable.actions')}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/candidates/${candidate.id}`}>{t('vacancies.viewDetails')}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/candidates/${candidate.id}/edit`}>{t('candTable.editCandidate')}</Link>
            </DropdownMenuItem>
            <CandidateStatusActions
              candidateId={candidate.id}
              candidateName={`${candidate.first_name} ${candidate.last_name}`.trim() || t('candTable.thisCandidate')}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
