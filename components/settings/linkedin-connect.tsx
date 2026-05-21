'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { LinkedInIntegration } from '@/lib/actions/integrations'

interface LinkedInConnectProps {
  integration: LinkedInIntegration | null
}

export function LinkedInConnect({ integration }: LinkedInConnectProps) {
  const params = useSearchParams()
  const status = params.get('linkedin')
  const [pageId, setPageId] = useState('')

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
      {status === 'error' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>Failed to connect LinkedIn. Please try again.</AlertDescription>
        </Alert>
      )}
      {status === 'invalid_page_id' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid page ID. Enter the numeric ID from your LinkedIn Company Page URL.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-start justify-between gap-4">
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
              ? `Page ID: ${integration.external_page_id}. Enables "Post to LinkedIn Jobs" on vacancies.`
              : 'Connect your LinkedIn company page to post jobs directly to LinkedIn Jobs from vacancies.'}
          </p>
        </div>

        {integration ? (
          <form action="/api/integrations/linkedin/disconnect" method="POST">
            <Button type="submit" variant="outline" size="sm">Disconnect</Button>
          </form>
        ) : (
          <form action="/api/integrations/linkedin/save" method="POST" className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <Input
                name="page_id"
                placeholder="e.g. 12345678"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                className="w-40 h-9 text-sm"
              />
              <Button type="submit" size="sm" disabled={!pageId.trim()}>Connect</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Find it at: linkedin.com/company/<strong>ID</strong>/admin/
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
