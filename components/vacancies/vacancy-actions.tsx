'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { updateVacancyStatus, deleteVacancy, duplicateVacancy } from '@/lib/actions/vacancies'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Loader2 } from 'lucide-react'

interface VacancyStatusOption {
  id: string
  name: string
  code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
}

interface VacancyActionsProps {
  vacancyId: string
  currentStatusId: string | null
  statusOptions: VacancyStatusOption[]
}

export function VacancyActions({
  vacancyId,
  currentStatusId,
  statusOptions,
}: VacancyActionsProps) {
  const router = useRouter()
  const [isDuplicating, setIsDuplicating] = useState(false)

  const handleStatusChange = async (statusId: string) => {
    await updateVacancyStatus(vacancyId, statusId)
    router.refresh()
  }

  const handleDuplicate = async () => {
    setIsDuplicating(true)
    const result = await duplicateVacancy(vacancyId)
    if (result.success) {
      router.push(`/vacancies/${result.data.id}/edit?duplicated=true`)
    } else {
      setIsDuplicating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this vacancy? This action cannot be undone.')) {
      return
    }
    const result = await deleteVacancy(vacancyId)
    if (result.success) {
      router.refresh()
    }
  }

  const openStatus = statusOptions.find((s) => s.code === 'open')
  const onHoldStatus = statusOptions.find((s) => s.code === 'on_hold')
  const closedStatus = statusOptions.find((s) => s.code === 'closed')
  const archivedStatus = statusOptions.find((s) => s.code === 'archived')

  return (
    <>
      {openStatus && currentStatusId !== openStatus.id && (
        <DropdownMenuItem onClick={() => handleStatusChange(openStatus.id)}>
          Set as Open
        </DropdownMenuItem>
      )}
      {onHoldStatus && currentStatusId !== onHoldStatus.id && (
        <DropdownMenuItem onClick={() => handleStatusChange(onHoldStatus.id)}>
          Put On Hold
        </DropdownMenuItem>
      )}
      {closedStatus && currentStatusId !== closedStatus.id && (
        <DropdownMenuItem onClick={() => handleStatusChange(closedStatus.id)}>
          Close Vacancy
        </DropdownMenuItem>
      )}
      {archivedStatus && currentStatusId !== archivedStatus.id && (
        <DropdownMenuItem onClick={() => handleStatusChange(archivedStatus.id)}>
          Archive Vacancy
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={handleDuplicate} disabled={isDuplicating}>
        {isDuplicating ? (
          <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Duplicating…</>
        ) : (
          'Duplicate Vacancy'
        )}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleDelete} className="text-destructive">
        Delete Vacancy
      </DropdownMenuItem>
    </>
  )
}
