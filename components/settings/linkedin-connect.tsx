'use client'

import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { LinkedInIntegration } from '@/lib/actions/integrations'

interface LinkedInConnectProps {
  integration: LinkedInIntegration | null
}

export function LinkedInConnect({ integration }: LinkedInConnectProps) {
  const params = useSearchParams()
  const status = params.get('linkedin')

  return (
    <div className="space-y-4">
      {status === 'connected' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>LinkedIn company page connected successfully.</AlertDescription>
        </Alert>
      )}
      {status === 'disconnected' && (
        <Alert>
          <AlertDescription>LinkedIn disconnected.</AlertDescription>
        </Alert>
      )}
      {(status === 'error' || status === 'not_configured') && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {status === 'not_configured'
              ? 'LinkedIn credentials are not configured on the server.'
              : 'Failed to connect LinkedIn. Please try again.'}
          </AlertDescription>
        </Alert>
      )}
      {status === 'no_pages' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            No LinkedIn company pages found. Make sure you are an Administrator of at least one LinkedIn company page.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">LinkedIn Company Page</span>
            {integration ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">Connected</Badge>
            ) : (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600">Not connected</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {integration
              ? `Connected to "${integration.external_page_name}". Enables "Post to LinkedIn Jobs" on vacancies.`
              : 'Connect your LinkedIn company page to post jobs directly to LinkedIn Jobs from vacancies.'}
          </p>
        </div>

        {integration ? (
          <form action="/api/integrations/linkedin/disconnect" method="POST">
            <Button type="submit" variant="outline" size="sm">Disconnect</Button>
          </form>
        ) : (
          <Button asChild size="sm">
            <a href="/api/integrations/linkedin/connect">Connect LinkedIn</a>
          </Button>
        )}
      </div>
    </div>
  )
}
