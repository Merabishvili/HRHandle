'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteCandidateDialog } from '@/components/candidates/delete-candidate-dialog'

export function DeleteCandidateButton({
  candidateId,
  candidateName,
}: {
  candidateId: string
  candidateName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 text-destructive hover:text-destructive"
        aria-label={`Delete ${candidateName}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>
      <DeleteCandidateDialog
        candidateId={candidateId}
        candidateName={candidateName}
        open={open}
        onOpenChange={setOpen}
        onDeleted={() => router.push('/candidates')}
      />
    </>
  )
}
