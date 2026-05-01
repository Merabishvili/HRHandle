import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

interface Props {
  groups: CustomFieldGroupWithFields[]
  values: CustomFieldValue[]
}

function formatValue(value: CustomFieldValue, fieldType: string): string | null {
  if (fieldType === 'checkbox') {
    if (value.value_boolean === true) return 'Yes'
    if (value.value_boolean === false) return 'No'
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

export function CustomFieldsDisplay({ groups, values }: Props) {
  const valueMap = new Map(values.map((v) => [v.field_id, v]))
  const visibleGroups = groups.filter((g) => g.fields.length > 0)

  if (visibleGroups.length === 0) return null

  const hasAnyValue = visibleGroups.some((g) =>
    g.fields.some((f) => {
      const v = valueMap.get(f.id)
      return v && formatValue(v, f.field_type) !== null
    })
  )

  if (!hasAnyValue) return null

  return (
    <>
      {visibleGroups.map((group) => {
        const filledFields = group.fields.filter((f) => {
          const v = valueMap.get(f.id)
          return v && formatValue(v, f.field_type) !== null
        })
        if (filledFields.length === 0) return null

        return (
          <div key={group.id} className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">
              {group.name}
            </h4>
            <div className="space-y-2">
              {filledFields.map((field) => {
                const v = valueMap.get(field.id)!
                const display = formatValue(v, field.field_type)
                const isLongText = field.field_type === 'long_text'

                if (isLongText) {
                  return (
                    <div key={field.id} className="space-y-0.5">
                      <span className="text-sm text-muted-foreground">{field.name}</span>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{display}</p>
                    </div>
                  )
                }

                return (
                  <div key={field.id} className="flex items-start justify-between gap-2">
                    <span className="text-sm text-muted-foreground">{field.name}</span>
                    <span className="text-sm font-medium text-foreground text-right">{display}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
