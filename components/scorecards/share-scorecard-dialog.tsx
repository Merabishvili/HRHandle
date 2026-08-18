'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations()
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
    if (!confirm(t('shareScorecard.revokeConfirm'))) {
      return
    }
    startTransition(async () => {
      const r = await revokeScorecardToken(applicationId)
      if (!r.success) {
        setError(r.error)
        return
      }
      setState(r.data)
      toast.success(t('shareScorecard.revoked'))
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
      toast.error(t('offer.copyFailed'))
    }
  }

  const hasLiveLink = !!state?.shareUrl

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('shareScorecard.title')}</DialogTitle>
          <DialogDescription>
            {t.rich('shareScorecard.desc', { name: candidateName, title: vacancyTitle, b: (c) => <strong>{c}</strong> })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('shareScorecard.checking')}
            </div>
          ) : hasLiveLink && state ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor="scorecard-share-url" className="text-xs font-medium text-foreground">
                  {t('shareScorecard.shareLink')}
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
                        {t('offer.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        {t('aiJd.copy')}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {(state.sharedByName || state.sharedAt) && (
                <p className="text-xs text-muted-foreground">
                  {state.sharedByName && state.sharedAt
                    ? t('shareScorecard.firstSharedByOn', { name: state.sharedByName, date: format(new Date(state.sharedAt), 'MMM d, yyyy') })
                    : state.sharedByName
                      ? t('shareScorecard.firstSharedBy', { name: state.sharedByName })
                      : t('shareScorecard.firstSharedOn', { date: format(new Date(state.sharedAt!), 'MMM d, yyyy') })}
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
                  {t('shareScorecard.revokeLink')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert>
                <AlertDescription>
                  {t('shareScorecard.noLinkYet')}
                </AlertDescription>
              </Alert>

              {state?.revokedAt && (
                <p className="text-xs text-muted-foreground">
                  {t('shareScorecard.prevRevoked', { date: format(new Date(state.revokedAt), 'MMM d, yyyy') })}
                </p>
              )}

              <Button type="button" onClick={handleGenerate} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('aiAssess.generating')}
                  </>
                ) : (
                  <>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    {t('shareScorecard.generateLink')}
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
