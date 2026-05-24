'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { updateCandidateStatus } from '@/lib/actions/candidates'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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

const STATUS_COLORS: Record<CandidateGeneralStatusOption['code'], string> = {
  new: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  in_process: 'bg-yellow-100 text-yellow-800',
  hired: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  archived: 'bg-zinc-100 text-zinc-600',
}

export function CandidateStatusSelect({
  candidateId,
  currentStatusId,
  statusOptions,
}: CandidateStatusSelectProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const initialOption =
    statusOptions.find((s) => s.id === currentStatusId) ?? statusOptions[0]
  const [activeOption, setActiveOption] = useState<CandidateGeneralStatusOption | undefined>(
    initialOption
  )

  async function handleSelect(option: CandidateGeneralStatusOption) {
    if (option.id === activeOption?.id) return
    const previous = activeOption
    setIsPending(true)
    setActiveOption(option)
    const result = await updateCandidateStatus(candidateId, option.id)
    if (!result.success) {
      setActiveOption(previous)
      toast.error('Failed to update status. Please try again.')
    } else {
      router.refresh()
    }
    setIsPending(false)
  }

  if (!activeOption) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isPending}>
        <button
          aria-label={`Candidate status: ${activeOption.name}. Click to change.`}
          className="inline-flex items-center gap-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Badge
            variant="secondary"
            className={cn(
              STATUS_COLORS[activeOption.code],
              'cursor-pointer select-none pr-1.5'
            )}
          >
            {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            {activeOption.name}
            <ChevronDown className="ml-1 h-3 w-3 opacity-60" aria-hidden="true" />
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        {statusOptions.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onSelect={() => handleSelect(option)}
            className="gap-2"
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                option.code === 'active' && 'bg-green-500',
                option.code === 'new' && 'bg-blue-400',
                option.code === 'in_process' && 'bg-yellow-500',
                option.code === 'hired' && 'bg-emerald-500',
                option.code === 'rejected' && 'bg-red-500',
                option.code === 'archived' && 'bg-zinc-400',
              )}
            />
            {option.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
