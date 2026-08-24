'use client'

import { useTranslations } from 'next-intl'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MAX_CUSTOM_FIELDS_PER_ENTITY } from '@/lib/custom-fields/constants'
import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

interface Props {
  groups: CustomFieldGroupWithFields[]
  values: Record<string, string>
  onChange: (fieldId: string, value: string) => void
  /** Render the block header ("Additional information" + N/MAX counter) above
   * the group cards. Default true; parents that supply their own heading pass
   * false. (#5/6/7) */
  showHeader?: boolean
}

export function CustomFieldsForm({ groups, values, onChange, showHeader = true }: Props) {
  const t = useTranslations()
  const visibleGroups = groups.filter((g) => g.fields.length > 0)
  if (visibleGroups.length === 0) return null
  const totalFields = visibleGroups.reduce((n, g) => n + g.fields.length, 0)

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold text-foreground">{t('cff.sectionTitle')}</h3>
            <p className="text-[12.5px] text-muted-foreground">{t('cff.sectionSubtitle')}</p>
          </div>
          <span className="shrink-0 rounded-md bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
            {t('cff.countBadge', { count: totalFields, max: MAX_CUSTOM_FIELDS_PER_ENTITY })}
          </span>
        </div>
      )}
      {visibleGroups.map((group) => (
        <div key={group.id} className="rounded-xl border border-border bg-card p-4 sm:p-[18px]">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-3">
            <h4 className="text-[15px] font-semibold text-foreground">{group.name}</h4>
            <span className="shrink-0 text-[12px] text-muted-foreground">
              {t('cff.fieldsCount', { count: group.fields.length })}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => {
              const val = values[field.id] ?? ''
              const isWide = field.field_type === 'long_text'

              return (
                <div
                  key={field.id}
                  className={`space-y-1.5${isWide ? ' sm:col-span-2' : ''}`}
                >
                  <Label htmlFor={`cf-${field.id}`} className="text-sm">
                    {field.name}
                    {field.is_required && (
                      <span className="ml-1 text-xs text-muted-foreground">{t('cff.required')}</span>
                    )}
                  </Label>

                  {field.field_type === 'text' && (
                    <Input
                      id={`cf-${field.id}`}
                      value={val}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      placeholder={field.name}
                      maxLength={100}
                    />
                  )}

                  {field.field_type === 'long_text' && (
                    <Textarea
                      id={`cf-${field.id}`}
                      value={val}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      placeholder={field.name}
                      maxLength={5000}
                      rows={4}
                    />
                  )}

                  {field.field_type === 'date' && (
                    <DatePicker
                      value={val || null}
                      onChange={(v) => onChange(field.id, v ?? '')}
                      placeholder={t('cff.pickDate')}
                      fromYear={1900}
                      toYear={new Date().getFullYear() + 10}
                    />
                  )}

                  {field.field_type === 'number' && (
                    <Input
                      id={`cf-${field.id}`}
                      type="number"
                      value={val}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      placeholder="0"
                    />
                  )}

                  {field.field_type === 'dropdown' && (
                    <Select
                      value={val || '__none__'}
                      onValueChange={(v) => onChange(field.id, v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger id={`cf-${field.id}`}>
                        <SelectValue placeholder={t('cff.selectPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('cff.none')}</SelectItem>
                        {(field.options || []).map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {field.field_type === 'checkbox' && (
                    <Select
                      value={val || '__none__'}
                      onValueChange={(v) => onChange(field.id, v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger id={`cf-${field.id}`}>
                        <SelectValue placeholder={t('cff.selectPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('cff.none')}</SelectItem>
                        <SelectItem value="true">{t('common.yes')}</SelectItem>
                        <SelectItem value="false">{t('common.no')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// Helper: convert flat values array to a Record<fieldId, string>
export function valuesToMap(values: CustomFieldValue[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const v of values) {
    if (v.value_boolean !== null && v.value_boolean !== undefined) {
      map[v.field_id] = v.value_boolean ? 'true' : 'false'
    } else if (v.value_number !== null && v.value_number !== undefined) {
      map[v.field_id] = String(v.value_number)
    } else if (v.value_option !== null && v.value_option !== undefined) {
      map[v.field_id] = v.value_option
    } else if (v.value_text !== null && v.value_text !== undefined) {
      map[v.field_id] = v.value_text
    }
  }
  return map
}

// Helper: convert flat map back to the upsert array expected by saveCustomFieldValues
export function mapToValueUpserts(
  fieldMap: Record<string, string>,
  groups: CustomFieldGroupWithFields[]
) {
  const result: Array<{
    fieldId: string
    valueText?: string | null
    valueNumber?: number | null
    valueBoolean?: boolean | null
    valueOption?: string | null
  }> = []

  for (const group of groups) {
    for (const field of group.fields) {
      const raw = fieldMap[field.id] ?? ''
      if (!raw) continue

      if (field.field_type === 'text' || field.field_type === 'long_text' || field.field_type === 'date') {
        result.push({ fieldId: field.id, valueText: raw })
      } else if (field.field_type === 'number') {
        const n = parseFloat(raw)
        if (!isNaN(n)) result.push({ fieldId: field.id, valueNumber: n })
      } else if (field.field_type === 'checkbox') {
        result.push({ fieldId: field.id, valueBoolean: raw === 'true' })
      } else if (field.field_type === 'dropdown') {
        result.push({ fieldId: field.id, valueOption: raw })
      }
    }
  }

  return result
}
