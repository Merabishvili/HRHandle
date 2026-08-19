import { Mail, Phone } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { TableCell } from '@/components/ui/table'
import { getStageStyle } from '@/lib/pipeline/stage-style'
import { pipelineStageLabel } from '@/lib/pipeline/status-i18n'
import { sourceLabel } from '@/lib/pipeline/source-i18n'
import type { CandidateRow, DerivedStage } from '@/lib/candidates/list-derivation'

interface CandidateOptionalCellProps {
  col: string
  candidate: CandidateRow
  stage?: DerivedStage | undefined
  fit?: number | undefined
  customFieldValueMap: Map<string, string>
}

/**
 * Renders the correct <TableCell> for one optional/custom column on the
 * Candidates list. Extracted from `candidates/page.tsx` (A-002) so the page
 * body reads as orchestration rather than a 130-line inline switch.
 */
export async function CandidateOptionalCell({
  col,
  candidate,
  stage,
  fit,
  customFieldValueMap,
}: CandidateOptionalCellProps) {
  const format = await getFormatter()
  const t = await getTranslations()
  switch (col) {
    case 'current_position':
      return (
        <TableCell>
          <div>
            <p className="text-sm">{candidate.current_position || '—'}</p>
            {candidate.current_company && (
              <p className="text-xs text-muted-foreground">{candidate.current_company}</p>
            )}
          </div>
        </TableCell>
      )
    case 'current_company':
      return (
        <TableCell className="text-sm text-muted-foreground">
          {candidate.current_company || '—'}
        </TableCell>
      )
    case 'created_at':
      return (
        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
          {format.relativeTime(new Date(candidate.created_at))}
        </TableCell>
      )
    case 'email':
      return (
        <TableCell>
          {candidate.email ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              {candidate.email}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
      )
    case 'phone':
      return (
        <TableCell>
          {candidate.phone ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              {candidate.phone}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
      )
    case 'years_of_experience':
      return (
        <TableCell className="text-sm text-muted-foreground">
          {candidate.years_of_experience != null
            ? t('columns.yearsValue', { count: candidate.years_of_experience })
            : '—'}
        </TableCell>
      )
    case 'source':
      return (
        <TableCell className="text-sm text-muted-foreground">
          {sourceLabel(t, candidate.source) || '—'}
        </TableCell>
      )
    case 'stage': {
      if (!stage) {
        return <TableCell className="text-sm text-muted-foreground">—</TableCell>
      }
      const style = getStageStyle(stage.code)
      return (
        <TableCell>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: style.pillBg, color: style.pillText }}
          >
            {pipelineStageLabel(t, stage.name)}
          </span>
        </TableCell>
      )
    }
    case 'fit_score':
      return (
        <TableCell className="text-sm tabular-nums text-muted-foreground">
          {typeof fit === 'number' ? `${fit}%` : '—'}
        </TableCell>
      )
    case 'location':
      return (
        <TableCell className="text-sm text-muted-foreground">
          {candidate.location || '—'}
        </TableCell>
      )
    case 'salary_expectation':
      return (
        <TableCell className="text-sm text-muted-foreground">
          {candidate.salary_expectation || '—'}
        </TableCell>
      )
    case 'notice_period':
      return (
        <TableCell className="text-sm text-muted-foreground">
          {candidate.notice_period || '—'}
        </TableCell>
      )
    case 'languages':
      return (
        <TableCell className="text-sm text-muted-foreground">
          {candidate.languages && candidate.languages.length > 0
            ? candidate.languages.join(', ')
            : '—'}
        </TableCell>
      )
    default:
      // Custom-field columns (key `cf_<fieldId>`).
      if (col.startsWith('cf_')) {
        const fieldId = col.slice(3)
        return (
          <TableCell className="text-sm text-muted-foreground">
            {customFieldValueMap.get(`${candidate.id}:${fieldId}`) || '—'}
          </TableCell>
        )
      }
      return <TableCell>—</TableCell>
  }
}
