'use client'

import { useState } from 'react'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Mail,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  EMAIL_TYPES,
  type EmailType,
  type EmailMode,
  type DraftedEmail,
} from '@/lib/ai/email-drafter'

export interface VacancyOption {
  id: string
  title: string
}

export interface AiEmailDrafterProps {
  candidateId: string
  /** Vacancies this candidate has applied to. The drafter can target a specific
   * role for context — picking "No specific role" keeps the email generic. */
  vacancyOptions: VacancyOption[]
}

type PanelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; email: DraftedEmail }
  | { status: 'too_thin' }
  | { status: 'rate_limited' }
  | { status: 'no_key' }
  | { status: 'malformed' }
  | { status: 'not_found' }
  | { status: 'failed' }

const TYPE_LABELS: Record<EmailType, string> = {
  rejection: 'Rejection',
  interview_invite: 'Interview invite',
  offer: 'Offer (soft / verbal)',
  follow_up: 'Follow-up',
  custom: 'Custom',
}

export function AiEmailDrafter({
  candidateId,
  vacancyOptions,
}: AiEmailDrafterProps) {
  const [open, setOpen] = useState(false)
  const [emailType, setEmailType] = useState<EmailType>('interview_invite')
  const [mode, setMode] = useState<EmailMode>('generate')
  const [vacancyId, setVacancyId] = useState<string>(
    vacancyOptions[0]?.id ?? '__none',
  )
  const [draft, setDraft] = useState('')
  const [contextText, setContextText] = useState('')
  const [panel, setPanel] = useState<PanelState>({ status: 'idle' })
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const generate = async () => {
    setPanel({ status: 'loading' })
    try {
      const res = await fetch('/api/ai/email-drafter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          vacancyId: vacancyId === '__none' ? null : vacancyId,
          type: emailType,
          mode,
          draft: mode === 'improve' ? draft.trim() || null : null,
          additional_context: contextText.trim() || null,
        }),
      })
      const body = await res.json()
      if (body.ok && body.email) {
        setPanel({ status: 'ok', email: body.email })
        return
      }
      const reason = body?.reason
      if (reason === 'too_thin') return setPanel({ status: 'too_thin' })
      if (reason === 'rate_limited') return setPanel({ status: 'rate_limited' })
      if (reason === 'no_key') return setPanel({ status: 'no_key' })
      if (reason === 'malformed') return setPanel({ status: 'malformed' })
      if (reason === 'not_found') return setPanel({ status: 'not_found' })
      setPanel({ status: 'failed' })
    } catch (err) {
      console.error('[ai-email-drafter] request failed:', err)
      setPanel({ status: 'failed' })
    }
  }

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500)
    } catch (err) {
      console.error('[ai-email-drafter] clipboard write failed:', err)
    }
  }

  const canSubmit =
    panel.status !== 'loading' &&
    (mode === 'generate' || draft.trim().length >= 20)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
      >
        <Mail className="h-4 w-4 text-primary" />
        <span className="text-[14px] font-bold text-foreground">
          AI email drafter
        </span>
        <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
          Assistant
        </span>
        {open ? (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Drafts a candidate email. Nothing is sent — you copy the result into your
            email tool and send it yourself. Subject, body, and any placeholders are
            yours to edit first.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ed-type" className="text-xs font-medium">
                Email type
              </Label>
              <Select
                value={emailType}
                onValueChange={(v) => setEmailType(v as EmailType)}
              >
                <SelectTrigger id="ed-type" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ed-mode" className="text-xs font-medium">
                Mode
              </Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as EmailMode)}
              >
                <SelectTrigger id="ed-mode" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generate">Generate from scratch</SelectItem>
                  <SelectItem value="improve">Improve my draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {vacancyOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="ed-vacancy" className="text-xs font-medium">
                Role context
              </Label>
              <Select value={vacancyId} onValueChange={setVacancyId}>
                <SelectTrigger id="ed-vacancy" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No specific role</SelectItem>
                  {vacancyOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === 'improve' && (
            <div className="space-y-1.5">
              <Label htmlFor="ed-draft" className="text-xs font-medium">
                Your draft
              </Label>
              <Textarea
                id="ed-draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste your draft here…"
                rows={5}
                maxLength={4000}
                className="text-sm"
                disabled={panel.status === 'loading'}
              />
              {draft.trim().length > 0 && draft.trim().length < 20 && (
                <p className="text-xs text-muted-foreground">
                  Add a few more sentences so the AI has something to work with.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ed-context" className="text-xs font-medium">
              Notes for the AI (optional)
            </Label>
            <Input
              id="ed-context"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="e.g. Interview is Thursday 3pm on Google Meet. Mention prep doc."
              maxLength={1000}
              className="text-sm"
              disabled={panel.status === 'loading'}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={generate}
              size="sm"
              variant="outline"
              disabled={!canSubmit}
            >
              {panel.status === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Drafting…
                </>
              ) : panel.status === 'ok' ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Redo
                </>
              ) : mode === 'improve' ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Improve draft
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Draft email
                </>
              )}
            </Button>
          </div>

          {panel.status === 'ok' && (
            <div className="space-y-3 rounded-md border border-border bg-background p-3">
              <p className="text-[11px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                AI-generated — recruiter has not reviewed
              </p>

              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Subject
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => copyText(panel.email.subject, 'subject')}
                  >
                    {copiedKey === 'subject' ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
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
                <p className="text-sm text-foreground">{panel.email.subject}</p>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Body
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => copyText(panel.email.body, 'body')}
                  >
                    {copiedKey === 'body' ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
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
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                  {panel.email.body}
                </pre>
              </div>

              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() =>
                  copyText(
                    `Subject: ${panel.email.subject}\n\n${panel.email.body}`,
                    'whole',
                  )
                }
              >
                {copiedKey === 'whole' ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Copied subject + body
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy subject + body
                  </>
                )}
              </Button>
            </div>
          )}

          {panel.status === 'too_thin' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {mode === 'improve'
                  ? 'Your draft is too short to improve. Add a few sentences and try again.'
                  : 'Add a role or some context notes so the AI knows what to write about.'}
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'rate_limited' && (
            <Alert>
              <AlertDescription>
                You&apos;ve generated a lot recently. Try again in a few minutes.
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'no_key' && (
            <Alert>
              <AlertDescription>
                AI features are not configured on this deployment.
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'malformed' && (
            <Alert variant="destructive">
              <AlertDescription>
                The AI returned an unexpected response. Try again.
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'not_found' && (
            <Alert variant="destructive">
              <AlertDescription>Candidate not found.</AlertDescription>
            </Alert>
          )}

          {panel.status === 'failed' && (
            <Alert variant="destructive">
              <AlertDescription>Could not draft. Try again.</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}
