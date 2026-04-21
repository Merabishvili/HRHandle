'use client'

import { useRouter } from 'next/navigation'
import { updateCandidateStatus } from '@/lib/actions/candidates'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CandidateGeneralStatusOption {
  id: string
  name: string
  code: 'new' | 'active' | 'in_process' | 'hired' | 'rejected' | 'archived'
}

interface CandidateStatusSelectProps {
  candidateId: string
  currentStatusId: string | null
  statusOptions: CandidateGeneralStatusOption[]
}

export function CandidateStatusSelect({
  candidateId,
  currentStatusId,
  statusOptions,
}: CandidateStatusSelectProps) {
  const router = useRouter()

  const handleChange = async (generalStatusId: string) => {
    await updateCandidateStatus(candidateId, generalStatusId)
    router.refresh()
  }

  return (
    <Select value={currentStatusId || ''} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((status) => (
          <SelectItem key={status.id} value={status.id}>
            {status.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
