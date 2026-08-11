'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { CheckCircle2, XCircle } from 'lucide-react'
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
import type { LinkedInIntegration } from '@/lib/actions/integrations'

interface LinkedInConnectProps {
  integration: LinkedInIntegration | null
}

export function LinkedInConnect({ integration }: LinkedInConnectProps) {
  const t = useTranslations()
  const params = useSearchParams()
  const status = params.get('linkedin')
  const [pageId, setPageId] = useState('')

  return (
    <div className="space-y-4">
      {status === 'connected' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{t('liConnect.connected')}</AlertDescription>
        </Alert>
      )}
      {status === 'disconnected' && (
        <Alert>
          <AlertDescription>{t('liConnect.disconnected')}</AlertDescription>
        </Alert>
      )}
      {status === 'error' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{t('liConnect.errFailed')}</AlertDescription>
        </Alert>
      )}
      {status === 'invalid_page_id' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {t('liConnect.errInvalidId')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('liConnect.title')}</span>
            {integration ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">{t('integrations.connected')}</Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">{t('integrations.notConnected')}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {integration
              ? t('liConnect.connectedDesc', { id: integration.external_page_id })
              : t('liConnect.connectDesc')}
          </p>
        </div>

        {integration ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">{t('integrations.disconnect')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('liConnect.disconnectTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('liConnect.disconnectDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <form action="/api/integrations/linkedin/disconnect" method="POST">
                  <AlertDialogAction type="submit">{t('integrations.disconnect')}</AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <form action="/api/integrations/linkedin/save" method="POST" className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <Input
                name="page_id"
                placeholder={t('liConnect.pageIdPlaceholder')}
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                className="w-40 h-9 text-sm"
              />
              <Button type="submit" size="sm" disabled={!pageId.trim()}>{t('integrations.connect')}</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.rich('liConnect.findItAt', { b: (c) => <strong>{c}</strong> })}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
