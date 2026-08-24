'use client'

import { useTranslations } from 'next-intl'

import { MAX_CUSTOM_FIELDS_PER_ENTITY } from '@/lib/custom-fields/constants'
import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

interface Props {
  groups: CustomFieldGroupWithFields[]
  values: CustomFieldValue[]
  /**
   * `rows` — compact label-left / value-right rows (vacancy detail, wide-ish).
   * `stacked` — label above, value below with wrapping (narrow candidate rail,
   * where values can be long). (#5/6/7)
   */
  variant?: 'rows' | 'stacked'
}

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
 * Read-only custom fields for the vacancy / candidate detail pages. Renders a
 * block header ("Additional information" + N/MAX counter), then each group as a
 * section with its own header + field-count badge, matching every other
 * custom-fields surface. Empty groups / values are hidden (never an empty
 * shell). (#5/6/7)
 */
export function CustomFieldsDisplay({ groups, values, variant = 'rows' }: Props) {
  const t = useTranslations()
  const yes = t('common.yes')
  const no = t('common.no')
  const valueMap = new Map(values.map((v) => [v.field_id, v]))
  const visibleGroups = groups.filter((g) => g.fields.length > 0)
  if (visibleGroups.length === 0) return null

  // Only groups with at least one filled value render.
  const groupsWithValues = visibleGroups
    .map((group) => ({
      group,
      filledFields: group.fields.filter((f) => {
        const v = valueMap.get(f.id)
        return v && formatValue(v, f.field_type, yes, no) !== null
      }),
    }))
    .filter((g) => g.filledFields.length > 0)

  if (groupsWithValues.length === 0) return null

  const totalFilled = groupsWithValues.reduce((n, g) => n + g.filledFields.length, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-bold text-foreground">{t('cff.sectionTitle')}</h3>
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {t('cff.countBadge', { count: totalFilled, max: MAX_CUSTOM_FIELDS_PER_ENTITY })}
        </span>
      </div>

      {groupsWithValues.map(({ group, filledFields }) => (
        <div key={group.id} className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
            <span className="text-[12px] font-semibold text-foreground">{group.name}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t('cff.fieldsCount', { count: filledFields.length })}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {filledFields.map((field) => {
              const display = formatValue(valueMap.get(field.id)!, field.field_type, yes, no)
              const stacked = variant === 'stacked' || field.field_type === 'long_text'
              if (stacked) {
                return (
                  <div key={field.id} className="flex flex-col gap-0.5">
                    <span className="text-[12px] text-muted-foreground">{field.name}</span>
                    <span className="whitespace-pre-wrap break-words text-[13px] font-semibold text-foreground [overflow-wrap:anywhere]">
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
        </div>
      ))}
    </div>
  )
}
