'use client'

import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ZoomConnectProps {
  isConnected: boolean
}

export function ZoomConnect({ isConnected }: ZoomConnectProps) {
  const params = useSearchParams()
  const status = params.get('zoom')

  return (
    <div className="space-y-4">
      {status === 'connected' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Zoom connected successfully.</AlertDescription>
        </Alert>
      )}
      {status === 'disconnected' && (
        <Alert>
          <AlertDescription>Zoom disconnected.</AlertDescription>
        </Alert>
      )}
      {(status === 'error' || status === 'not_configured') && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {status === 'not_configured'
              ? 'Zoom OAuth credentials are not configured on the server.'
              : 'Failed to connect Zoom. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Zoom</span>
            {isConnected ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">Connected</Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">Not connected</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isConnected
              ? 'Video interviews can auto-create Zoom meetings with a join link.'
              : 'Connect to auto-create Zoom meetings when scheduling video interviews.'}
          </p>
        </div>

        {isConnected ? (
          <form action="/api/auth/zoom/disconnect" method="POST">
            <Button type="submit" variant="outline" size="sm">
              Disconnect
            </Button>
          </form>
        ) : (
          <Button asChild size="sm">
            <a href="/api/auth/zoom">Connect Zoom</a>
          </Button>
        )}
      </div>
    </div>
  )
}
