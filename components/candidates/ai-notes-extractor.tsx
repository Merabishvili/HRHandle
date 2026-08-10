'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Save,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AiDraftTag } from '@/components/ui/ai-draft-tag'
import { createNote } from '@/lib/actions/notes'
import {
  MAX_NOTES_LENGTH,
  MIN_NOTES_LENGTH,
  type StructuredNotes,
} from '@/lib/ai/note-extractor'

export interface AiNotesExtractorProps {
  candidateId: string
}

type PanelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; structured: StructuredNotes }
  | { status: 'too_thin' }
  | { status: 'rate_limited' }
  | { status: 'no_key' }
  | { status: 'malformed' }
  | { status: 'failed' }

const SECTION_LABEL_KEYS: Record<keyof StructuredNotes | 'summary', string> = {
  summary: 'aiNotes.summary',
  strengths: 'aiNotes.strengths',
  concerns: 'aiNotes.concerns',
  key_skills_demonstrated: 'aiNotes.skillsDemonstrated',
  follow_ups: 'aiNotes.followUps',
}

/** Builds the saved-note markdown. `labels` + `header` are passed in so the
 * persisted note uses the recruiter's UI language. */
function formatAsMarkdown(
  s: StructuredNotes,
  labels: Record<keyof StructuredNotes | 'summary', string>,
  header: string,
): string {
  const block = (label: string, items: string[]) =>
    items.length === 0
      ? ''
      : `**${label}**\n${items.map((i) => `- ${i}`).join('\n')}\n\n`

  return [
    `${header}\n`,
    s.summary ? `${s.summary}\n\n` : '',
    block(labels.strengths, s.strengths),
    block(labels.concerns, s.concerns),
    block(labels.key_skills_demonstrated, s.key_skills_demonstrated),
    block(labels.follow_ups, s.follow_ups),
  ]
    .join('')
    .trim()
}

/**
 * Interview-notes assistant. Lives in the right sidebar of the candidate
 * detail page. Recruiter pastes raw notes → AI extracts a structured view.
 * Advisory only — never modifies the candidate record without an explicit
 * "Save as note" click.
 */
export function AiNotesExtractor({ candidateId }: AiNotesExtractorProps) {
  const t = useTranslations()
  const router = useRouter()
  const sectionLabels = {
    summary: t('aiNotes.summary'),
    strengths: t('aiNotes.strengths'),
    concerns: t('aiNotes.concerns'),
    key_skills_demonstrated: t('aiNotes.skillsDemonstrated'),
    follow_ups: t('aiNotes.followUps'),
  }
  const [isOpen, setIsOpen] = useState(false)
  const [rawNotes, setRawNotes] = useState('')
  const [panel, setPanel] = useState<PanelState>({ status: 'idle' })
  const [copied, setCopied] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, startSaveTransition] = useTransition()

  const tooShort = rawNotes.trim().length < MIN_NOTES_LENGTH
  const tooLong = rawNotes.length > MAX_NOTES_LENGTH

  const extract = async () => {
    setSaved(false)
    setSaveError(null)
    setPanel({ status: 'loading' })
    try {
      const res = await fetch('/api/ai/note-extractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, raw_notes: rawNotes }),
      })
      const body = await res.json()
      if (body.ok && body.structured) {
        setPanel({ status: 'ok', structured: body.structured })
        return
      }
      const reason = body?.reason
      if (reason === 'too_thin') return setPanel({ status: 'too_thin' })
      if (reason === 'rate_limited') return setPanel({ status: 'rate_limited' })
      if (reason === 'no_key') return setPanel({ status: 'no_key' })
      if (reason === 'malformed') return setPanel({ status: 'malformed' })
      setPanel({ status: 'failed' })
    } catch (err) {
      console.error('[ai-notes-extractor] request failed:', err)
      setPanel({ status: 'failed' })
    }
  }

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    } catch (err) {
      console.error('[ai-notes-extractor] clipboard write failed:', err)
    }
  }

  const saveAsNote = () => {
    if (panel.status !== 'ok' || isSaving) return
    setSaveError(null)
    startSaveTransition(async () => {
      const result = await createNote(candidateId, formatAsMarkdown(panel.structured, sectionLabels, t('aiNotes.savedHeader')))
      if (!result.success) {
        setSaveError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground"
        aria-expanded={isOpen}
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span>{t('aiNotes.headerTitle')}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          {t('aiJd.assistant')}
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-3 border-t border-primary/20 px-3 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t('aiNotes.intro')}
          </p>

          <Textarea
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            placeholder={t('aiNotes.placeholder')}
            rows={6}
            maxLength={MAX_NOTES_LENGTH + 100}
            className="text-sm"
            disabled={panel.status === 'loading' || isSaving}
          />
          <p className="text-[10px] text-right text-muted-foreground">
            {rawNotes.length} / {MAX_NOTES_LENGTH}
          </p>

          <Button
            type="button"
            onClick={extract}
            size="sm"
            variant="outline"
            className="w-full"
            disabled={tooShort || tooLong || panel.status === 'loading'}
          >
            {panel.status === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('aiNotes.extracting')}
              </>
            ) : panel.status === 'ok' ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('aiNotes.reExtract')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {t('aiNotes.extractStructure')}
              </>
            )}
          </Button>

          {tooShort && rawNotes.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {t('aiNotes.tooShort', { min: MIN_NOTES_LENGTH })}
            </p>
          )}
          {tooLong && (
            <p className="text-[11px] text-destructive">
              {t('aiNotes.tooLong', { max: MAX_NOTES_LENGTH })}
            </p>
          )}

          {panel.status === 'ok' && (
            <div className="space-y-3">
              <div>
                <AiDraftTag label={t('aiJd.aiDraft')} />
              </div>

              {/* Summary */}
              {panel.structured.summary && (
                <Section
                  label={sectionLabels.summary}
                  copyKey="summary"
                  copied={copied}
                  onCopy={() => copyText(panel.structured.summary, 'summary')}
                >
                  <p className="text-[13px] leading-relaxed text-foreground">
                    {panel.structured.summary}
                  </p>
                </Section>
              )}

              {/* Bullet sections */}
              {(['strengths', 'concerns', 'key_skills_demonstrated', 'follow_ups'] as const).map(
                (key) => {
                  const list = panel.structured[key]
                  if (list.length === 0) return null
                  return (
                    <Section
                      key={key}
                      label={t(SECTION_LABEL_KEYS[key])}
                      copyKey={`cat-${key}`}
                      copied={copied}
                      onCopy={() =>
                        copyText(list.map((q, i) => `${i + 1}. ${q}`).join('\n'), `cat-${key}`)
                      }
                    >
                      <ul className="space-y-1.5">
                        {list.map((item, idx) => {
                          const k = `${key}-${idx}`
                          return (
                            <li
                              key={k}
                              className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground"
                            >
                              <span className="flex-1">- {item}</span>
                              <button
                                type="button"
                                onClick={() => copyText(item, k)}
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                                aria-label={t('aiJd.copy')}
                              >
                                {copied === k ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </Section>
                  )
                },
              )}

              {saveError && (
                <Alert variant="destructive">
                  <AlertDescription className="text-[12px]">{saveError}</AlertDescription>
                </Alert>
              )}

              {saved && (
                <p className="text-[12px] text-green-700 dark:text-green-500">
                  {t('aiNotes.savedNote')}
                </p>
              )}

              {!saved && (
                <Button
                  type="button"
                  onClick={saveAsNote}
                  size="sm"
                  variant="default"
                  className="w-full"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {t('aiNotes.saveAsNote')}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {panel.status === 'too_thin' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-[12px]">
                {t('aiNotes.tooThinMsg')}
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'rate_limited' && (
            <Alert>
              <AlertDescription className="text-[12px]">
                {t('aiNotes.rateLimited')}
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'no_key' && (
            <Alert>
              <AlertDescription className="text-[12px]">
                {t('wizard.aiNotConfigured')}
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'malformed' && (
            <Alert variant="destructive">
              <AlertDescription className="text-[12px]">
                {t('aiNotes.malformed')}
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'failed' && (
            <Alert variant="destructive">
              <AlertDescription className="text-[12px]">
                {t('aiNotes.failed')}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  label,
  copyKey,
  copied,
  onCopy,
  children,
}: {
  label: string
  copyKey: string
  copied: string | null
  onCopy: () => void
  children: React.ReactNode
}) {
  const t = useTranslations()
  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCopy}
          className="h-6 px-2 text-[11px]"
        >
          {copied === copyKey ? (
            <>
              <Check className="mr-1 h-3 w-3" />
              {t('offer.copied')}
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3 w-3" />
              {t('aiJd.copy')}
            </>
          )}
        </Button>
      </div>
      {children}
    </div>
  )
}
