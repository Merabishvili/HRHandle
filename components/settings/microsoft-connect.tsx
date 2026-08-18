'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle } from 'lucide-react'

interface MicrosoftConnectProps {
  isConnected: boolean
}

export function MicrosoftConnect({ isConnected }: MicrosoftConnectProps) {
  const t = useTranslations()
  const params = useSearchParams()
  const status = params.get('microsoft')

  return (
    <div className="space-y-4">
      {status === 'connected' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{t('msConnect.connected')}</AlertDescription>
        </Alert>
      )}
      {status === 'disconnected' && (
        <Alert>
          <AlertDescription>{t('msConnect.disconnected')}</AlertDescription>
        </Alert>
      )}
      {(status === 'error' ||
        status === 'not_configured' ||
        status === 'denied' ||
        status === 'state_mismatch' ||
        status === 'token_exchange_failed') && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {status === 'not_configured'
              ? t('msConnect.notConfigured')
              : status === 'denied'
              ? t('msConnect.denied')
              : status === 'state_mismatch'
              ? t('msConnect.stateMismatch')
              : status === 'token_exchange_failed'
              ? t('msConnect.tokenFailed')
              : t('msConnect.errFailed')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('msConnect.title')}</span>
            {isConnected ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">{t('integrations.connected')}</Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">{t('integrations.notConnected')}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isConnected
              ? t('msConnect.descConnected')
              : t('msConnect.descDisconnected')}
          </p>
        </div>

        {isConnected ? (
          <form action="/api/auth/microsoft/disconnect" method="POST">
            <Button type="submit" variant="outline" size="sm">
              {t('integrations.disconnect')}
            </Button>
          </form>
        ) : (
          <Button asChild size="sm">
            <a href="/api/auth/microsoft">{t('msConnect.connect')}</a>
          </Button>
        )}
      </div>
    </div>
  )
}
