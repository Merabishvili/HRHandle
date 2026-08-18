'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle } from 'lucide-react'

interface GoogleCalendarConnectProps {
  isConnected: boolean
}

export function GoogleCalendarConnect({ isConnected }: GoogleCalendarConnectProps) {
  const t = useTranslations()
  const params = useSearchParams()
  const status = params.get('google')

  return (
    <div className="space-y-4">
      {status === 'connected' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{t('gcalConnect.connected')}</AlertDescription>
        </Alert>
      )}
      {status === 'disconnected' && (
        <Alert>
          <AlertDescription>{t('gcalConnect.disconnected')}</AlertDescription>
        </Alert>
      )}
      {(status === 'error' || status === 'not_configured' || status === 'state_mismatch' || status === 'token_exchange_failed' || status === 'scope_missing' || status === 'denied') && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {status === 'not_configured' && t('gcalConnect.notConfigured')}
            {status === 'state_mismatch' && t('gcalConnect.stateMismatch')}
            {status === 'token_exchange_failed' && t('gcalConnect.tokenFailed')}
            {status === 'scope_missing' && t('gcalConnect.scopeMissing')}
            {status === 'denied' && t('gcalConnect.denied')}
            {status === 'error' && t('gcalConnect.errFailed')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('gcalConnect.title')}</span>
            {isConnected ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">{t('integrations.connected')}</Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">{t('integrations.notConnected')}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isConnected
              ? t('gcalConnect.descConnected')
              : t('gcalConnect.descDisconnected')}
          </p>
        </div>

        {isConnected ? (
          <form action="/api/auth/google/disconnect" method="POST">
            <Button type="submit" variant="outline" size="sm">
              {t('integrations.disconnect')}
            </Button>
          </form>
        ) : (
          <Button asChild size="sm">
            <a href="/api/auth/google">{t('gcalConnect.connect')}</a>
          </Button>
        )}
      </div>
    </div>
  )
}
