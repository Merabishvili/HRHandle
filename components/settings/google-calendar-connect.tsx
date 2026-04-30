'use client'

import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle } from 'lucide-react'

interface GoogleCalendarConnectProps {
  isConnected: boolean
}

export function GoogleCalendarConnect({ isConnected }: GoogleCalendarConnectProps) {
  const params = useSearchParams()
  const status = params.get('google')

  return (
    <div className="space-y-4">
      {status === 'connected' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Google Calendar connected successfully.</AlertDescription>
        </Alert>
      )}
      {status === 'disconnected' && (
        <Alert>
          <AlertDescription>Google Calendar disconnected.</AlertDescription>
        </Alert>
      )}
      {(status === 'error' || status === 'not_configured') && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {status === 'not_configured'
              ? 'Google OAuth credentials are not configured on the server.'
              : 'Failed to connect Google Calendar. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Google Calendar</span>
            {isConnected ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">Connected</Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">Not connected</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isConnected
              ? 'Video interviews can create Google Calendar events with Meet links.'
              : 'Connect to auto-create Google Meet links when scheduling video interviews.'}
          </p>
        </div>

        {isConnected ? (
          <form action="/api/auth/google/disconnect" method="POST">
            <Button type="submit" variant="outline" size="sm">
              Disconnect
            </Button>
          </form>
        ) : (
          <Button asChild size="sm">
            <a href="/api/auth/google">Connect Google</a>
          </Button>
        )}
      </div>
    </div>
  )
}
