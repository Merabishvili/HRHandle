'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { VacancyStatus } from '@/lib/types'

interface VacancyActionsProps {
  vacancyId: string
  currentStatus: VacancyStatus
}

export function VacancyActions({ vacancyId, currentStatus }: VacancyActionsProps) {
  const router = useRouter()

  const updateStatus = async (status: VacancyStatus) => {
    const supabase = createClient()
    await supabase
      .from('vacancies')
      .update({ status })
      .eq('id', vacancyId)
    router.refresh()
  }

  const deleteVacancy = async () => {
    if (!confirm('Are you sure you want to delete this vacancy? This action cannot be undone.')) {
      return
    }
    const supabase = createClient()
    await supabase.from('vacancies').delete().eq('id', vacancyId)
    router.refresh()
  }

  return (
    <>
      {currentStatus !== 'active' && (
        <DropdownMenuItem onClick={() => updateStatus('active')}>
          Set as Active
        </DropdownMenuItem>
      )}
      {currentStatus !== 'paused' && currentStatus !== 'draft' && (
        <DropdownMenuItem onClick={() => updateStatus('paused')}>
          Pause vacancy
        </DropdownMenuItem>
      )}
      {currentStatus !== 'closed' && (
        <DropdownMenuItem onClick={() => updateStatus('closed')}>
          Close vacancy
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={deleteVacancy} className="text-destructive">
        Delete vacancy
      </DropdownMenuItem>
    </>
  )
}
