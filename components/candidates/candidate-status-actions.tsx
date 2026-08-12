'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { DeleteCandidateDialog } from '@/components/candidates/delete-candidate-dialog'

interface CandidateStatusActionsProps {
  candidateId: string
  candidateName: string
}

/**
 * Wave 1.1 — General Status is no longer user-editable; the "Move to
 * Active / Hired / Archived" items are gone. Candidate status is now
 * derived from the application stage(s) and synced by the app-level
 * code on stage transitions. This component now hosts just the Delete
 * affordance on the candidates-index row ⋮ menu.
 */
export function CandidateStatusActions({
  candidateId,
  candidateName,
}: CandidateStatusActionsProps) {
  const t = useTranslations()
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
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
        {t('candidates.deleteCandidate')}
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
