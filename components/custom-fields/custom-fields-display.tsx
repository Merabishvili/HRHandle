'use client'

import { useTranslations } from 'next-intl'

import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

interface Props {
  groups: CustomFieldGroupWithFields[]
  values: CustomFieldValue[]
}

/** Values longer than this can't fit on one line in the narrow sidebar, so they
 * render stacked (label above, value below + wrap) instead of a row that would
 * overflow off the card edge (#5/6/7). */
const STACK_VALUE_OVER = 24

function formatValue(
  value: CustomFieldValue,
  fieldType: string,
  yes: string,
  no: string,
): string | null {
  if (fieldType === 'checkbox') {
    if (value.value_boolean === true) return yes
    if (value.value_boolean === false) return no
    return null
  }
  if (fieldType === 'number') {
    return value.value_number !== null && value.value_number !== undefined
      ? String(value.value_number)
      : null
  }
  if (fieldType === 'dropdown') {
    return value.value_option || null
  }
  if (fieldType === 'date') {
    if (!value.value_text) return null
    const d = new Date(value.value_text)
    if (isNaN(d.getTime())) return value.value_text
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return value.value_text || null
}

/**
 * Read-only custom fields for the vacancy / candidate detail sidebars. Each
 * group renders as its OWN sidebar card (matching the Details / Posting-details
 * cards), no counters or badges. Within a card, long_text fields render stacked
 * (label above, value wraps) and everything else as a compact label-left /
 * value-right row. Empty groups / values are hidden. (#5/6/7)
 */
export function CustomFieldsDisplay({ groups, values }: Props) {
  const t = useTranslations()
  const yes = t('common.yes')
  const no = t('common.no')
  const valueMap = new Map(values.map((v) => [v.field_id, v]))

  const groupsWithValues = groups
    .filter((g) => g.fields.length > 0)
    .map((group) => ({
      group,
      filledFields: group.fields.filter((f) => {
        const v = valueMap.get(f.id)
        return v && formatValue(v, f.field_type, yes, no) !== null
      }),
    }))
    .filter((g) => g.filledFields.length > 0)

  if (groupsWithValues.length === 0) return null

  return (
    <>
      {groupsWithValues.map(({ group, filledFields }) => (
        <section
          key={group.id}
          className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]"
          aria-label={group.name}
        >
          <h3 className="mb-3 text-[15px] font-bold text-foreground">{group.name}</h3>
          <div className="flex flex-col gap-3">
            {filledFields.map((field) => {
              const display = formatValue(valueMap.get(field.id)!, field.field_type, yes, no)
              // Long-text fields, or any value too long to fit on one line, stack
              // (label above, value below) so nothing overflows the card.
              const stacked = field.field_type === 'long_text' || (display?.length ?? 0) > STACK_VALUE_OVER
              if (stacked) {
                return (
                  <div key={field.id} className="flex flex-col gap-0.5">
                    <span className="text-[12px] text-muted-foreground">{field.name}</span>
                    <span className="whitespace-pre-wrap break-words text-[14px] font-semibold text-foreground [overflow-wrap:anywhere]">
                      {display}
                    </span>
                  </div>
                )
              }
              return (
                <div key={field.id} className="flex items-start justify-between gap-3 text-[13px]">
                  <span className="text-muted-foreground">{field.name}</span>
                  <span className="break-words text-right font-semibold text-foreground [overflow-wrap:anywhere]">
                    {display}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
