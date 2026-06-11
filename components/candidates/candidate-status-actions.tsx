'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCandidateStatus } from '@/lib/actions/candidates'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { DeleteCandidateDialog } from '@/components/candidates/delete-candidate-dialog'

interface CandidateGeneralStatusOption {
  id: string
  name: string
  code: 'new' | 'active' | 'in_process' | 'hired' | 'rejected' | 'archived'
}

interface CandidateStatusActionsProps {
  candidateId: string
  candidateName: string
  currentStatusId: string | null
  statusOptions: CandidateGeneralStatusOption[]
}

export function CandidateStatusActions({
  candidateId,
  candidateName,
  currentStatusId,
  statusOptions,
}: CandidateStatusActionsProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleStatusChange = async (generalStatusId: string) => {
    await updateCandidateStatus(candidateId, generalStatusId)
    router.refresh()
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
      <DropdownMenuItem
        // The dropdown menu would otherwise close before the dialog mounts,
        // so we prevent the default close behaviour and open the dialog
        // ourselves. Pattern recommended by Radix for "menu item opens dialog".
        onSelect={(e) => {
          e.preventDefault()
          setDeleteOpen(true)
        }}
        className="text-destructive"
      >
        Delete candidate
      </DropdownMenuItem>
      <DeleteCandidateDialog
        candidateId={candidateId}
        candidateName={candidateName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
