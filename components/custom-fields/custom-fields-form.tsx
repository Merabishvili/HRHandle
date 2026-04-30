'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

interface Props {
  groups: CustomFieldGroupWithFields[]
  values: Record<string, string>
  onChange: (fieldId: string, value: string) => void
}

export function CustomFieldsForm({ groups, values, onChange }: Props) {
  const visibleGroups = groups.filter((g) => g.fields.length > 0)
  if (visibleGroups.length === 0) return null

  return (
    <>
      {visibleGroups.map((group) => (
        <div key={group.id} className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
            {group.name}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => {
              const val = values[field.id] ?? ''

              return (
                <div key={field.id} className="space-y-1.5">
                  <Label htmlFor={`cf-${field.id}`} className="text-sm">
                    {field.name}
                    {field.is_required && (
                      <span className="ml-1 text-xs text-muted-foreground">(required)</span>
                    )}
                  </Label>

                  {field.field_type === 'text' && (
                    <Input
                      id={`cf-${field.id}`}
                      value={val}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      placeholder={field.name}
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
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
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
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
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

      if (field.field_type === 'text') {
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
