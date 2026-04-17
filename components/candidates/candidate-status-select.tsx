'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CandidateStatus } from '@/lib/types'

interface CandidateStatusSelectProps {
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

export function CandidateStatusSelect({ candidateId, currentStatus }: CandidateStatusSelectProps) {
  const router = useRouter()

  const updateStatus = async (status: CandidateStatus) => {
    const supabase = createClient()
    await supabase
      .from('candidates')
      .update({ status })
      .eq('id', candidateId)
    router.refresh()
  }

  return (
    <Select value={currentStatus} onValueChange={updateStatus}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
