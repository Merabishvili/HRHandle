'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteVacancy } from '@/lib/actions/vacancies'

export function DeleteVacancyButton({
  vacancyId,
  vacancyTitle,
}: {
  vacancyId: string
  vacancyTitle: string
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const handleDelete = async () => {
    setIsPending(true)
    const result = await deleteVacancy(vacancyId)
    if (result.success) {
      toast.success(`Vacancy "${vacancyTitle}" deleted.`)
      router.push('/vacancies')
    } else {
      toast.error(result.error)
      setIsPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isPending} className="text-destructive hover:text-destructive">
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete vacancy?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{vacancyTitle}</strong> will be removed from the list. Existing
            applications stay on the candidate records. This action can be reversed
            by an admin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting…' : 'Delete vacancy'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
