'use client'

import { useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IMPORT_COLUMNS, ERROR_LABEL_KEY } from './columns'
import type { ImportField } from '@/lib/candidate-import/parsing'
import type { ValidatedRow, ImportError } from '@/lib/candidate-import/validation'

const NUM_W = 40
const DEL_W = 48
const ROW_H = 40 // estimate; real height measured (error rows are taller)

interface Props {
  /** Rows already ordered + filtered by the caller. */
  rows: ValidatedRow[]
  mode: 'edit' | 'readonly'
  /** `csv` = original CSV row number; `sequential` = 1..n over survivors. */
  numbering: 'csv' | 'sequential'
  onCommitCell?: (csvRow: number, field: ImportField, value: string) => void
  onDeleteRow?: (csvRow: number) => void
}

const GRID = `${NUM_W}px ${IMPORT_COLUMNS.map((c) => `${c.width}px`).join(' ')} ${DEL_W}px`
const TOTAL_W = NUM_W + IMPORT_COLUMNS.reduce((s, c) => s + c.width, 0) + DEL_W

export function ImportDataTable({ rows, mode, numbering, onCommitCell, onDeleteRow }: Props) {
  const t = useTranslations()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState<{ csvRow: number; field: ImportField } | null>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
    getItemKey: (i) => rows[i]?.csvRow ?? i,
  })

  const commit = useCallback(
    (csvRow: number, field: ImportField, value: string, next?: { csvRow: number; field: ImportField } | null) => {
      onCommitCell?.(csvRow, field, value)
      setEditing(next ?? null)
    },
    [onCommitCell],
  )

  const items = virtualizer.getVirtualItems()

  return (
    <div
      ref={scrollRef}
      role="table"
      aria-rowcount={rows.length}
      className="max-h-[560px] overflow-auto rounded-lg border border-border bg-card"
    >
      <div style={{ width: TOTAL_W, position: 'relative' }}>
        {/* header */}
        <div
          role="row"
          className="sticky top-0 z-20 grid items-center border-b border-border bg-background text-[11px] font-semibold text-muted-foreground"
          style={{ gridTemplateColumns: GRID }}
        >
          <div role="columnheader" className="sticky left-0 z-10 bg-background px-2 py-2.5">#</div>
          {IMPORT_COLUMNS.map((c, i) => (
            <div
              role="columnheader"
              key={c.field}
              className={cn(
                'truncate px-2 py-2.5',
                i === 0 && 'sticky z-10 bg-background',
              )}
              style={i === 0 ? { left: NUM_W } : undefined}
            >
              {t(c.labelKey)}
              {c.required ? ' *' : ''}
            </div>
          ))}
          <div role="columnheader" className="sticky right-0 z-10 bg-background" aria-label="" />
        </div>

        {/* virtualized body */}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {items.map((vi) => {
            const row = rows[vi.index]
            if (!row) return null
            const isError = row.status === 'error'
            const displayNum = numbering === 'sequential' ? vi.index + 1 : row.csvRow
            const rowBg = isError ? 'bg-destructive/[0.04]' : 'bg-card'
            return (
              <div
                key={row.csvRow}
                role="row"
                data-index={vi.index}
                ref={virtualizer.measureElement}
                className={cn('absolute left-0 top-0 w-full border-b border-border/60', rowBg)}
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                <div className="grid items-center" style={{ gridTemplateColumns: GRID }}>
                  <div className={cn('sticky left-0 z-10 px-2 py-2 font-mono text-[12px] text-muted-foreground', rowBg)}>
                    {displayNum}
                  </div>
                  {IMPORT_COLUMNS.map((c, i) => (
                    <Cell
                      key={c.field}
                      row={row}
                      field={c.field}
                      mode={mode}
                      sticky={i === 0}
                      rowBg={rowBg}
                      editing={editing?.csvRow === row.csvRow && editing?.field === c.field}
                      onStartEdit={() => mode === 'edit' && setEditing({ csvRow: row.csvRow, field: c.field })}
                      onCommit={(value, dir) => {
                        let next: { csvRow: number; field: ImportField } | null = null
                        if (dir === 'down') {
                          const nr = rows[vi.index + 1]
                          if (nr) next = { csvRow: nr.csvRow, field: c.field }
                        } else if (dir === 'right') {
                          const nf = IMPORT_COLUMNS[i + 1]
                          if (nf) next = { csvRow: row.csvRow, field: nf.field }
                        }
                        commit(row.csvRow, c.field, value, next)
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ))}
                  <div className={cn('sticky right-0 z-10 flex items-center justify-center py-2', rowBg)}>
                    {mode === 'edit' && (
                      <button
                        type="button"
                        aria-label={t('csvImport.deleteRowAria', { n: row.csvRow })}
                        onClick={() => onDeleteRow?.(row.csvRow)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-[15px] w-[15px]" />
                      </button>
                    )}
                  </div>
                </div>

                {mode === 'edit' && isError && (
                  <div className="space-y-0.5 px-2 pb-2" style={{ paddingLeft: NUM_W + 8 }}>
                    {row.errors.map((err, ei) => (
                      <ErrorLine key={ei} error={err} row={row} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Cell({
  row,
  field,
  mode,
  sticky,
  rowBg,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  row: ValidatedRow
  field: ImportField
  mode: 'edit' | 'readonly'
  sticky: boolean
  rowBg: string
  editing: boolean
  onStartEdit: () => void
  onCommit: (value: string, dir: 'down' | 'right' | null) => void
  onCancel: () => void
}) {
  const value = row.values[field] ?? ''
  const err = row.errors.find((e) => e.field === field)
  const isRequiredEmpty = err && (err.code === 'firstNameRequired' || err.code === 'lastNameRequired')
  const t = useTranslations()

  const base = cn(
    'px-2 py-2 text-[12px]',
    sticky && 'sticky z-10',
    sticky && rowBg,
  )
  const style = sticky ? { left: NUM_W } : undefined

  if (editing) {
    return (
      <div className={base} style={style}>
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- click-to-edit must focus the cell immediately
          autoFocus
          defaultValue={value}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => onCommit(e.currentTarget.value, null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onCommit((e.target as HTMLInputElement).value, 'down')
            } else if (e.key === 'Tab') {
              e.preventDefault()
              onCommit((e.target as HTMLInputElement).value, 'right')
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          className="w-full rounded-[5px] border border-destructive bg-card px-1.5 py-1 text-[12px] text-foreground outline-none focus:shadow-[0_0_0_3px_oklch(0.577_0.245_27.325_/_0.12)]"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(base, mode === 'edit' && 'cursor-text')}
      style={style}
      onClick={mode === 'edit' ? onStartEdit : undefined}
      aria-invalid={err ? true : undefined}
    >
      {err ? (
        <span
          className={cn(
            'block truncate rounded-[5px] border px-1.5 py-1 text-destructive',
            isRequiredEmpty ? 'border-dashed border-destructive' : 'border-destructive bg-card',
          )}
          title={value || undefined}
        >
          {value || (isRequiredEmpty ? t('csvImport.emptyCell') : '')}
        </span>
      ) : (
        <span className="block truncate text-foreground" title={value || undefined}>
          {value || <span className="text-muted-foreground/50">—</span>}
        </span>
      )}
    </div>
  )
}

function ErrorLine({ error, row }: { error: ImportError; row: ValidatedRow }) {
  const t = useTranslations()
  const email = (row.values.email ?? '').trim()
  return (
    <div role="status" className="flex items-center gap-1.5">
      <AlertCircle className="h-[13px] w-[13px] shrink-0 text-destructive" />
      <span className="text-[12px] text-destructive">{t(ERROR_LABEL_KEY[error.code])}</span>
      {error.code === 'dupExisting' && email && (
        <a
          href={`/candidates?search=${encodeURIComponent(email)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-medium text-primary hover:underline"
        >
          {t('csvImport.viewExisting')}
        </a>
      )}
    </div>
  )
}
