'use client'

import { useState, useTransition } from 'react'
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

interface Props {
  applicationId: string
}

export function CalendlyLinkButton({ applicationId }: Props) {
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
      else setError(res.error)
    })
  }

  async function onCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed — select and copy manually.')
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={onOpen} className="gap-2">
        <CalendarIcon className="h-3.5 w-3.5" />
        Calendly link
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calendly scheduling link</DialogTitle>
            <DialogDescription>
              Send this to the candidate. When they book, HRHandle will create the interview record automatically.
            </DialogDescription>
          </DialogHeader>

          {isPending && <p className="text-sm text-muted-foreground">Generating link…</p>}

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
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
