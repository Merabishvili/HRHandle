'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ZoomConnectProps {
  isConnected: boolean
}

export function ZoomConnect({ isConnected }: ZoomConnectProps) {
  const t = useTranslations()
  const params = useSearchParams()
  const status = params.get('zoom')

  return (
    <div className="space-y-4">
      {status === 'connected' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{t('zoomConnect.connected')}</AlertDescription>
        </Alert>
      )}
      {status === 'disconnected' && (
        <Alert>
          <AlertDescription>{t('zoomConnect.disconnected')}</AlertDescription>
        </Alert>
      )}
      {(status === 'error' || status === 'not_configured') && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {status === 'not_configured'
              ? t('zoomConnect.notConfigured')
              : t('zoomConnect.errFailed')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Zoom</span>
            {isConnected ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">{t('integrations.connected')}</Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">{t('integrations.notConnected')}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isConnected
              ? t('zoomConnect.descConnected')
              : t('zoomConnect.descDisconnected')}
          </p>
        </div>

        {isConnected ? (
          <form action="/api/auth/zoom/disconnect" method="POST">
            <Button type="submit" variant="outline" size="sm">
              {t('integrations.disconnect')}
            </Button>
          </form>
        ) : (
          <Button asChild size="sm">
            <a href="/api/auth/zoom">{t('zoomConnect.connect')}</a>
          </Button>
        )}
      </div>
    </div>
  )
}
