'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Loader2, AlertTriangle } from 'lucide-react'
import { deleteOrganization } from '@/lib/actions/organization'

export interface DangerZoneProps {
  organizationName: string
}

export function DangerZone({ organizationName }: DangerZoneProps) {
  const t = useTranslations()
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Server-side check is case-insensitive trim — mirror that here so the
  // button enables at the same moment the action would accept the input.
  const matches =
    confirmName.trim().toLowerCase() === organizationName.trim().toLowerCase()

  const handleDelete = () => {
    if (!matches || isPending) return
    setError(null)
    startTransition(async () => {
      const result = await deleteOrganization({ confirmName })
      // Server action redirects on success — we only land back here on failure.
      if (result && !result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
          {t('vacSettings.dangerZone')}
        </CardTitle>
        <CardDescription>
          {t('dangerZone.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-red-200 dark:border-red-900 p-4">
          <h3 className="font-semibold">{t('dangerZone.deleteOrg')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.rich('dangerZone.deleteOrgDesc', {
              name: organizationName,
              b: (c) => <strong>{c}</strong>,
              d: (c) => <strong>{c}</strong>,
            })}
          </p>

          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mt-4">
            <AlertDialog
              open={open}
              onOpenChange={(next) => {
                setOpen(next)
                if (!next) {
                  setConfirmName('')
                  setError(null)
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive">{t('dangerZone.deleteOrgButton')}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('dangerZone.deleteConfirmTitle', { name: organizationName })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t.rich('dangerZone.deleteConfirmDesc', { b: (c) => <strong>{c}</strong> })}
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-2 py-2">
                  <Label htmlFor="confirmName">
                    {t.rich('dangerZone.typeToConfirm', { name: organizationName, b: (c) => <strong>{c}</strong> })}
                  </Label>
                  <Input
                    id="confirmName"
                    type="text"
                    autoComplete="off"
                    autoFocus
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    disabled={isPending}
                    placeholder={organizationName}
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      // Prevent the dialog's auto-close on action; we let
                      // the server action's redirect navigate away on success
                      // or keep the dialog open to show the error.
                      e.preventDefault()
                      handleDelete()
                    }}
                    disabled={!matches || isPending}
                    className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('dangerZone.scheduling')}
                      </>
                    ) : (
                      t('dangerZone.permanentlyDelete')
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
