'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Calendar as CalendarIcon, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { buildCalendlyLinkForApplication } from '@/lib/actions/calendly-link'
import { cn } from '@/lib/utils'

interface Props {
  applicationId: string
  className?: string
}

// The action's messages are English; show the reader's language by code.
function linkErrorKey(code: string | undefined): string {
  switch (code) {
    case 'VALIDATION': return 'calLink.errNotSetUp'
    case 'CONFLICT': return 'calLink.errEventGone'
    default: return 'calLink.errCalendly'
  }
}

export function CalendlyLinkButton({ applicationId, className }: Props) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onOpen() {
    setOpen(true)
    setError(null)
    setUrl(null)
    startTransition(async () => {
      const res = await buildCalendlyLinkForApplication(applicationId)
      if (res.success) setUrl(res.data.url_with_tracking)
      else setError(t(linkErrorKey(res.code)))
    })
  }

  async function onCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('calLink.copyFailed'))
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={onOpen} className={cn('gap-2', className)}>
        <CalendarIcon className="h-3.5 w-3.5" />
        {t('calLink.button')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('calLink.title')}</DialogTitle>
            <DialogDescription>
              {t('calLink.desc')}
            </DialogDescription>
          </DialogHeader>

          {isPending && <p className="text-sm text-muted-foreground">{t('calLink.generating')}</p>}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {url && (
            <div className="space-y-2">
              <Input id="calendly-link-url" readOnly value={url} className="font-mono text-xs" />
              <Button onClick={onCopy} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t('offer.copied') : t('applyForm.copyLink')}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
