'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { activateApplicationForm, deactivateApplicationForm } from '@/lib/actions/application-form'
import { Copy, Check, ExternalLink, Trash2, AlertTriangle, Link as LinkIcon } from 'lucide-react'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || ''

interface Props {
  vacancyId: string
  initialToken: string | null
}

export function ApplicationFormTab({ vacancyId, initialToken }: Props) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [copied, setCopied] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const formUrl = token ? `${BASE_URL}/apply/${token}` : null

  const handleActivate = () => {
    setError(null)
    startTransition(async () => {
      const result = await activateApplicationForm(vacancyId)
      if (!result.success) { setError(result.error); return }
      setToken(result.data.token)
    })
  }

  const handleDeactivate = () => {
    if (!confirmDeactivate) { setConfirmDeactivate(true); return }
    setError(null)
    startTransition(async () => {
      const result = await deactivateApplicationForm(vacancyId)
      if (!result.success) { setError(result.error); return }
      setToken(null)
      setConfirmDeactivate(false)
    })
  }

  const handleCopy = async () => {
    if (!formUrl) return
    await navigator.clipboard.writeText(formUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!token ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <LinkIcon className="h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No application form active</h3>
          <p className="mt-1 mb-6 text-sm text-muted-foreground max-w-sm">
            Activate a public form to collect applications directly from candidates. The link can be shared on LinkedIn or any job board.
          </p>
          <Button onClick={handleActivate} disabled={isPending}>
            {isPending ? 'Activating...' : 'Activate Application Form'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Application Form</h3>
            <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            Share this link on LinkedIn or any job board. Candidates can apply without creating an account.
          </p>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="flex-1 truncate text-sm font-mono text-foreground">{formUrl}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="shrink-0 h-8 w-8 p-0"
              title="Copy link"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
            <a
              href={formUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Open form"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="rounded-lg border border-border bg-background p-4 space-y-2">
            <h4 className="text-sm font-medium text-foreground">What candidates will see</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Job description, responsibilities and requirements from this vacancy</li>
              <li>• Fields: First name, Last name, Email (required), Phone, LinkedIn URL</li>
              <li>• CV upload (PDF or Word, required)</li>
              <li>• Automatic confirmation email sent to the applicant</li>
            </ul>
          </div>

          <div className="pt-2 border-t border-border">
            {confirmDeactivate ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  The link will stop working immediately. Existing applications are kept.
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeactivate}
                  disabled={isPending}
                >
                  {isPending ? 'Deactivating...' : 'Confirm Deactivate'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDeactivate(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeactivate}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isPending}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Deactivate Form
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
