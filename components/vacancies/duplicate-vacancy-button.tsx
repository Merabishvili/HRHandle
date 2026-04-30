'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { duplicateVacancy } from '@/lib/actions/vacancies'

export function DuplicateVacancyButton({ vacancyId }: { vacancyId: string }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const handleDuplicate = async () => {
    setIsPending(true)
    const result = await duplicateVacancy(vacancyId)
    if (result.success) {
      router.push(`/vacancies/${result.data.id}/edit?duplicated=true`)
    } else {
      setIsPending(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleDuplicate} disabled={isPending}>
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Copy className="mr-2 h-4 w-4" />
      )}
      {isPending ? 'Duplicating…' : 'Duplicate'}
    </Button>
  )
}
