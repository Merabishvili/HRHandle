'use client'

import { useRouter } from 'next/navigation'
import { updateCandidateStatus, deleteCandidate } from '@/lib/actions/candidates'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'

interface CandidateGeneralStatusOption {
  id: string
  name: string
  code: 'new' | 'active' | 'in_process' | 'hired' | 'rejected' | 'archived'
}

interface CandidateStatusActionsProps {
  candidateId: string
  currentStatusId: string | null
  statusOptions: CandidateGeneralStatusOption[]
}

export function CandidateStatusActions({
  candidateId,
  currentStatusId,
  statusOptions,
}: CandidateStatusActionsProps) {
  const router = useRouter()

  const handleStatusChange = async (generalStatusId: string) => {
    await updateCandidateStatus(candidateId, generalStatusId)
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
      return
    }
    const result = await deleteCandidate(candidateId)
    if (result.success) {
      router.push('/candidates')
    }
  }

  return (
    <>
      <DropdownMenuSeparator />
      {statusOptions
        .filter((status) => status.id !== currentStatusId)
        .map((status) => (
          <DropdownMenuItem key={status.id} onClick={() => handleStatusChange(status.id)}>
            Move to {status.name}
          </DropdownMenuItem>
        ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleDelete} className="text-destructive">
        Delete candidate
      </DropdownMenuItem>
    </>
  )
}
