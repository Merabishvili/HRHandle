'use client'

import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle } from 'lucide-react'

interface MicrosoftConnectProps {
  isConnected: boolean
}

export function MicrosoftConnect({ isConnected }: MicrosoftConnectProps) {
  const params = useSearchParams()
  const status = params.get('microsoft')

  return (
    <div className="space-y-4">
      {status === 'connected' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Microsoft account connected successfully.</AlertDescription>
        </Alert>
      )}
      {status === 'disconnected' && (
        <Alert>
          <AlertDescription>Microsoft account disconnected.</AlertDescription>
        </Alert>
      )}
      {(status === 'error' || status === 'not_configured' || status === 'denied') && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {status === 'not_configured'
              ? 'Microsoft OAuth credentials are not configured on the server.'
              : status === 'denied'
              ? 'Microsoft connection was cancelled.'
              : 'Failed to connect Microsoft account. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Microsoft (Calendar + Teams)</span>
            {isConnected ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">Connected</Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">Not connected</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isConnected
              ? 'Video interviews can auto-create Teams meetings and add them to your Outlook Calendar.'
              : 'Connect to auto-create Teams meetings and Outlook Calendar events when scheduling video interviews.'}
          </p>
        </div>

        {isConnected ? (
          <form action="/api/auth/microsoft/disconnect" method="POST">
            <Button type="submit" variant="outline" size="sm">
              Disconnect
            </Button>
          </form>
        ) : (
          <Button asChild size="sm">
            <a href="/api/auth/microsoft">Connect Microsoft</a>
          </Button>
        )}
      </div>
    </div>
  )
}
