'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import {
  createCustomFieldGroup,
  createCustomField,
  deleteCustomField,
  deleteCustomFieldGroup,
  addDropdownOption,
  type CustomFieldGroupWithFields,
  type EntityType,
  type FieldType,
} from '@/lib/actions/custom-fields'

interface Props {
  candidateGroups: CustomFieldGroupWithFields[]
  vacancyGroups: CustomFieldGroupWithFields[]
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Free Text',
  number: 'Number',
  dropdown: 'Dropdown',
  checkbox: 'Yes / No',
}

function countFields(groups: CustomFieldGroupWithFields[]) {
  return groups.reduce((sum, g) => sum + g.fields.length, 0)
}

function EntitySection({
  entityType,
  groups: initialGroups,
}: {
  entityType: EntityType
  groups: CustomFieldGroupWithFields[]
}) {
  const [groups, setGroups] = useState(initialGroups)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  // Group creation
  const [newGroupName, setNewGroupName] = useState('')
  const [groupError, setGroupError] = useState<string | null>(null)

  // Field creation (per group)
  const [addingFieldGroupId, setAddingFieldGroupId] = useState<string | null>(null)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newDropdownOptions, setNewDropdownOptions] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  // Delete confirmations
  const [confirmDeleteFieldId, setConfirmDeleteFieldId] = useState<string | null>(null)
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null)

  // Dropdown option addition (per field)
  const [addingOptionFieldId, setAddingOptionFieldId] = useState<string | null>(null)
  const [newOption, setNewOption] = useState('')
  const [optionError, setOptionError] = useState<string | null>(null)

  const fieldCount = countFields(groups)
  const atLimit = fieldCount >= 20

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreateGroup = () => {
    setGroupError(null)
    const trimmed = newGroupName.trim()
    if (!trimmed) { setGroupError('Group name is required'); return }

    startTransition(async () => {
      const result = await createCustomFieldGroup(entityType, trimmed)
      if (!result.success) { setGroupError(result.error); return }
      const newGroup = {
        id: result.data.id,
        name: trimmed,
        entity_type: entityType,
        sort_order: groups.length + 1,
        fields: [],
      }
      setGroups((prev) => [...prev, newGroup])
      setExpandedGroups((prev) => new Set([...prev, result.data.id]))
      setNewGroupName('')
    })
  }

  const handleDeleteGroup = (groupId: string) => {
    if (confirmDeleteGroupId !== groupId) {
      setConfirmDeleteGroupId(groupId)
      return
    }
    startTransition(async () => {
      const result = await deleteCustomFieldGroup(groupId)
      if (!result.success) { setGroupError(result.error); return }
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
      setConfirmDeleteGroupId(null)
    })
  }

  const handleCreateField = (groupId: string) => {
    setFieldError(null)
    const trimmed = newFieldName.trim()
    if (!trimmed) { setFieldError('Field name is required'); return }
    if (atLimit) { setFieldError('20-field limit reached for this entity.'); return }

    const options =
      newFieldType === 'dropdown'
        ? newDropdownOptions.split(',').map((o) => o.trim()).filter(Boolean)
        : undefined

    if (newFieldType === 'dropdown' && (!options || options.length === 0)) {
      setFieldError('Enter at least one option for dropdown fields (comma-separated).')
      return
    }

    startTransition(async () => {
      const result = await createCustomField({
        groupId,
        entityType,
        name: trimmed,
        fieldType: newFieldType,
        isRequired: newFieldRequired,
        options,
      })
      if (!result.success) { setFieldError(result.error); return }

      const newField = {
        id: result.data.id,
        group_id: groupId,
        name: trimmed,
        field_type: newFieldType,
        is_required: newFieldRequired,
        options: options ?? null,
        sort_order: 0,
        deleted_at: null,
      }
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, fields: [...g.fields, newField] } : g
        )
      )
      setAddingFieldGroupId(null)
      setNewFieldName('')
      setNewFieldType('text')
      setNewFieldRequired(false)
      setNewDropdownOptions('')
    })
  }

  const handleDeleteField = (fieldId: string, groupId: string) => {
    if (confirmDeleteFieldId !== fieldId) {
      setConfirmDeleteFieldId(fieldId)
      return
    }
    startTransition(async () => {
      const result = await deleteCustomField(fieldId)
      if (!result.success) return
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, fields: g.fields.filter((f) => f.id !== fieldId) } : g
        )
      )
      setConfirmDeleteFieldId(null)
    })
  }

  const handleAddOption = (fieldId: string, groupId: string) => {
    setOptionError(null)
    const trimmed = newOption.trim()
    if (!trimmed) { setOptionError('Option value is required'); return }

    startTransition(async () => {
      const result = await addDropdownOption(fieldId, trimmed)
      if (!result.success) { setOptionError(result.error); return }
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                fields: g.fields.map((f) =>
                  f.id === fieldId
                    ? { ...f, options: [...(f.options || []), trimmed] }
                    : f
                ),
              }
            : g
        )
      )
      setAddingOptionFieldId(null)
      setNewOption('')
    })
  }

  const label = entityType === 'candidate' ? 'Candidate' : 'Vacancy'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{label} Fields</h3>
          <p className="text-sm text-muted-foreground">
            {fieldCount} / 20 fields used
          </p>
        </div>
        {atLimit && (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            Limit reached
          </Badge>
        )}
      </div>

      {groupError && (
        <Alert variant="destructive">
          <AlertDescription>{groupError}</AlertDescription>
        </Alert>
      )}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No groups yet. Add a group to get started.</p>
      )}

      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.id)
        const isConfirmingGroupDelete = confirmDeleteGroupId === group.id
        const isAddingField = addingFieldGroupId === group.id

        return (
          <div key={group.id} className="rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {group.name}
                <Badge variant="secondary" className="text-xs">
                  {group.fields.length} field{group.fields.length !== 1 ? 's' : ''}
                </Badge>
              </button>

              <div className="flex items-center gap-2">
                {isConfirmingGroupDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Delete group and all its fields?
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteGroup(group.id)}
                      disabled={isPending}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDeleteGroupId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteGroup(group.id)}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                {group.fields.length === 0 && !isAddingField && (
                  <p className="text-sm text-muted-foreground">No fields in this group.</p>
                )}

                {group.fields.map((field) => {
                  const isConfirmingDelete = confirmDeleteFieldId === field.id
                  const isAddingOption = addingOptionFieldId === field.id

                  return (
                    <div
                      key={field.id}
                      className="rounded-md bg-muted/40 px-3 py-2 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{field.name}</span>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {FIELD_TYPE_LABELS[field.field_type as FieldType]}
                          </Badge>
                          {field.is_required && (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              Required
                            </Badge>
                          )}
                        </div>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              All saved values will be lost.
                            </span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteField(field.id, group.id)}
                              disabled={isPending}
                            >
                              Delete
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmDeleteFieldId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteField(field.id, group.id)}
                            disabled={isPending}
                            className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {field.field_type === 'dropdown' && (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {(field.options || []).map((opt) => (
                              <Badge key={opt} variant="outline" className="text-xs">
                                {opt}
                              </Badge>
                            ))}
                          </div>

                          {isAddingOption ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={newOption}
                                onChange={(e) => setNewOption(e.target.value)}
                                placeholder="New option"
                                className="h-7 text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddOption(field.id, group.id)
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAddOption(field.id, group.id)}
                                disabled={isPending}
                                className="h-7"
                              >
                                Add
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setAddingOptionFieldId(null); setNewOption(''); setOptionError(null) }}
                                className="h-7"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setAddingOptionFieldId(field.id); setOptionError(null) }}
                              className="text-xs text-primary hover:underline"
                            >
                              + Add option
                            </button>
                          )}

                          {isAddingOption && optionError && (
                            <p className="text-xs text-destructive">{optionError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {fieldError && isAddingField && (
                  <Alert variant="destructive">
                    <AlertDescription>{fieldError}</AlertDescription>
                  </Alert>
                )}

                {isAddingField ? (
                  <div className="rounded-md border border-dashed border-border p-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Field Name *</Label>
                        <Input
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          placeholder="e.g. LinkedIn Score"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={newFieldType}
                          onValueChange={(v) => setNewFieldType(v as FieldType)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(FIELD_TYPE_LABELS).map(([val, lbl]) => (
                              <SelectItem key={val} value={val}>{lbl}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {newFieldType === 'dropdown' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Options (comma-separated) *</Label>
                        <Input
                          value={newDropdownOptions}
                          onChange={(e) => setNewDropdownOptions(e.target.value)}
                          placeholder="Option A, Option B, Option C"
                          className="h-8 text-sm"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`req-${group.id}`}
                        checked={newFieldRequired}
                        onChange={(e) => setNewFieldRequired(e.target.checked)}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor={`req-${group.id}`} className="text-xs cursor-pointer">
                        Mark as required
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleCreateField(group.id)}
                        disabled={isPending || atLimit}
                      >
                        Add Field
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAddingFieldGroupId(null)
                          setNewFieldName('')
                          setNewFieldType('text')
                          setNewFieldRequired(false)
                          setNewDropdownOptions('')
                          setFieldError(null)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  !atLimit && (
                    <button
                      type="button"
                      onClick={() => { setAddingFieldGroupId(group.id); setFieldError(null) }}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add field
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add new group */}
      <div className="flex items-center gap-2 pt-2">
        <Input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder={`New ${label.toLowerCase()} group name`}
          className="h-9 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCreateGroup()
            }
          }}
        />
        <Button size="sm" onClick={handleCreateGroup} disabled={isPending}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Group
        </Button>
      </div>
    </div>
  )
}

export function CustomFieldsManager({ candidateGroups, vacancyGroups }: Props) {
  const [activeTab, setActiveTab] = useState<EntityType>('candidate')

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border">
        {(['candidate', 'vacancy'] as EntityType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`pb-2 px-1 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'candidate' ? 'Candidates' : 'Vacancies'}
          </button>
        ))}
      </div>

      {activeTab === 'candidate' ? (
        <EntitySection entityType="candidate" groups={candidateGroups} />
      ) : (
        <EntitySection entityType="vacancy" groups={vacancyGroups} />
      )}
    </div>
  )
}
