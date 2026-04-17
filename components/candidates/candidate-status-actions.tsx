'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import type { CandidateStatus } from '@/lib/types'

interface CandidateStatusActionsProps {
  candidateId: string
  currentStatus: CandidateStatus
}

const statusOptions: { value: CandidateStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
]

export function CandidateStatusActions({ candidateId, currentStatus }: CandidateStatusActionsProps) {
  const router = useRouter()

  const updateStatus = async (status: CandidateStatus) => {
    const supabase = createClient()
    await supabase
      .from('candidates')
      .update({ status })
      .eq('id', candidateId)
    router.refresh()
  }

  const deleteCandidate = async () => {
    if (!confirm('Are you sure you want to delete this candidate? This action cannot be undone.')) {
      return
    }
    const supabase = createClient()
    await supabase.from('candidates').delete().eq('id', candidateId)
    router.push('/candidates')
    router.refresh()
  }

  return (
    <>
      <DropdownMenuSeparator />
      {statusOptions
        .filter((s) => s.value !== currentStatus)
        .map((status) => (
          <DropdownMenuItem key={status.value} onClick={() => updateStatus(status.value)}>
            Move to {status.label}
          </DropdownMenuItem>
        ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={deleteCandidate} className="text-destructive">
        Delete candidate
      </DropdownMenuItem>
    </>
  )
}
