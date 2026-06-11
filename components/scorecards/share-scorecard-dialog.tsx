'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Check, Copy, Link as LinkIcon, Loader2, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

import {
  getScorecardShareState,
  getOrCreateScorecardToken,
  revokeScorecardToken,
  type ScorecardShareState,
} from '@/lib/actions/scorecards'

export interface ShareScorecardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  candidateName: string
  vacancyTitle: string
}

// Three-row dialog: copy link, last-shared timestamp, revoke. The link is
// generated lazily — opening the dialog just reads current state; clicking
// "Generate link" creates the token. This lets a recruiter open the dialog
// to check whether a share exists without accidentally creating one.
export function ShareScorecardDialog({
  open,
  onOpenChange,
  applicationId,
  candidateName,
  vacancyTitle,
}: ShareScorecardDialogProps) {
  const [state, setState] = useState<ScorecardShareState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      // Reset when closing so a revoke from a prior open doesn't linger.
      setState(null)
      setError(null)
      setCopied(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    getScorecardShareState(applicationId).then((r) => {
      if (cancelled) return
      setIsLoading(false)
      if (r.success) {
        setState(r.data)
      } else {
        setError(r.error)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, applicationId])

  const handleGenerate = () => {
    setError(null)
    startTransition(async () => {
      const r = await getOrCreateScorecardToken(applicationId)
      if (!r.success) {
        setError(r.error)
        return
      }
      setState(r.data)
    })
  }

  const handleRevoke = () => {
    setError(null)
    if (
      !confirm(
        'Revoke this share link? The current URL will stop working immediately. You can generate a new link afterwards.',
      )
    ) {
      return
    }
    startTransition(async () => {
      const r = await revokeScorecardToken(applicationId)
      if (!r.success) {
        setError(r.error)
        return
      }
      setState(r.data)
      toast.success('Share link revoked.')
    })
  }

  const handleCopy = async () => {
    if (!state?.shareUrl) return
    try {
      await navigator.clipboard.writeText(state.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('[scorecards] clipboard failed:', err)
      toast.error('Could not copy link.')
    }
  }

  const hasLiveLink = !!state?.shareUrl

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share scorecard</DialogTitle>
          <DialogDescription>
            Share <strong>{candidateName}</strong>&apos;s evaluation for{' '}
            <strong>{vacancyTitle}</strong> with someone who isn&apos;t in HRHandle.
            They see only the answers and scores — no recruiter notes, no contact
            details, no pipeline status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking share status…
            </div>
          ) : hasLiveLink && state ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor="scorecard-share-url" className="text-xs font-medium text-foreground">
                  Share link
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="scorecard-share-url"
                    value={state.shareUrl ?? ''}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    disabled={isPending}
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {(state.sharedByName || state.sharedAt) && (
                <p className="text-xs text-muted-foreground">
                  First shared
                  {state.sharedByName ? ` by ${state.sharedByName}` : ''}
                  {state.sharedAt
                    ? ` on ${format(new Date(state.sharedAt), 'MMM d, yyyy')}`
                    : ''}
                  .
                </p>
              )}

              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={handleRevoke}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Revoke link
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert>
                <AlertDescription>
                  No share link yet. Click below to generate one — you can revoke it
                  at any time.
                </AlertDescription>
              </Alert>

              {state?.revokedAt && (
                <p className="text-xs text-muted-foreground">
                  Previous link revoked on{' '}
                  {format(new Date(state.revokedAt), 'MMM d, yyyy')}. Generating a new
                  link below produces a different URL.
                </p>
              )}

              <Button type="button" onClick={handleGenerate} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Generate link
                  </>
                )}
              </Button>
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
