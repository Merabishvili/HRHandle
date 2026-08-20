'use client'

import { Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AiDraftTag } from '@/components/ui/ai-draft-tag'
import { cn } from '@/lib/utils'

export type AiDraftPanelStatus = 'idle' | 'generating' | 'ready' | 'error'

interface AiDraftPanelProps {
  /** Status of the AI invocation. Drives which controls are visible. */
  status: AiDraftPanelStatus
  /** Label shown in the calm-blue tag once draft content is ready. */
  tag?: string
  /** Header title (e.g. "AI summary", "Suggest scorecard attributes"). */
  title: string
  /** Optional short description shown in the idle state, above the invoke button. */
  description?: string
  /** Label on the invoke button (e.g. "Generate summary", "Suggest from JD"). */
  invokeLabel?: string
  /** Called when the user clicks the invoke button (idle state). */
  onInvoke?: () => void
  /** Called when the user clicks Regenerate (ready/error state). */
  onRegenerate?: () => void
  /** Called when the user clicks Apply (ready state). Optional — some AI surfaces don't have a confirm step (e.g. provenance-only views). */
  onApply?: () => void
  /** Called when the user dismisses the draft (ready/error state). */
  onCancel?: () => void
  /** Inline error message shown in the error state. */
  errorMessage?: string
  /** Body content of the draft (ready state). The shell owns the chrome; the caller supplies the editable / scrollable inner content. */
  children?: React.ReactNode
  /** Optional extra classes on the outer card. */
  className?: string
}

/**
 * Shared shell for AI features per S10 §2.2: invoke → draft → review → confirm.
 *
 * Calm-blue accent (no alarm orange, no uppercase "NOT REVIEWED" stamps).
 * Provenance via the embedded <AiDraftTag /> once a draft is ready. The
 * invoke button is off by default; nothing auto-runs.
 *
 * Existing AI components today (ai-jd-suggest, ai-notes-extractor, etc.)
 * have feature-specific state machines and can stay as-is — they already
 * use <AiDraftTag /> for the calm-tag swap from Wave 1.6. This shell is
 * the forward-looking starting point for NEW AI surfaces (e.g. AI Fit
 * Analysis per ai-fit-analysis.md) so they pick up the locked pattern
 * without reinventing the chrome.
 */
export function AiDraftPanel({
  status,
  tag = 'AI draft',
  title,
  description,
  invokeLabel = 'Suggest with AI',
  onInvoke,
  onRegenerate,
  onApply,
  onCancel,
  errorMessage,
  children,
  className,
}: AiDraftPanelProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[15px] font-bold text-foreground">{title}</span>
        {status === 'ready' && (
          <span className="ml-auto">
            <AiDraftTag label={tag} />
          </span>
        )}
      </div>

      {status === 'idle' && (
        <div>
          {description && (
            <p className="mb-3 text-sm text-muted-foreground">{description}</p>
          )}
          {onInvoke && (
            <Button onClick={onInvoke} size="sm" variant="outline">
              <Sparkles className="mr-2 h-4 w-4" />
              {invokeLabel}
            </Button>
          )}
        </div>
      )}

      {status === 'generating' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating…
        </div>
      )}

      {status === 'ready' && (
        <div>
          {children}
          <div className="mt-4 flex flex-wrap gap-2">
            {onApply && (
              <Button onClick={onApply} size="sm">
                Apply
              </Button>
            )}
            {onRegenerate && (
              <Button onClick={onRegenerate} size="sm" variant="ghost">
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            )}
            {onCancel && (
              <Button onClick={onCancel} size="sm" variant="ghost">
                <X className="mr-2 h-4 w-4" />
                Discard
              </Button>
            )}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div>
          {errorMessage && (
            <p className="mb-3 text-sm text-destructive">{errorMessage}</p>
          )}
          {onRegenerate && (
            <Button onClick={onRegenerate} size="sm" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
