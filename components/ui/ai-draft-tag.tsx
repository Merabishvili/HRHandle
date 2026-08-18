import { Sparkles } from 'lucide-react'

interface AiDraftTagProps {
  /**
   * Pre-S10 framing was "AI-generated — recruiter has not reviewed or edited"
   * rendered in alarm-amber uppercase. The new framing is calm + brief —
   * see `docs/redesign/flows/S10-ai-terminology.md` §2.2 / §2.4 for the
   * feature → label map. Defaults to "AI draft" — the most common case.
   *
   * Common values used today:
   * - "AI draft"         — generated content the user can keep / edit / discard (JD, summary, scorecard-from-notes)
   * - "AI suggestion"    — non-content advice (bias check, scorecard attribute suggestions)
   * - "AI-filled · review" — auto-prefilled form fields (CV parse)
   * - "AI-assisted"      — provenance on a saved field that AI contributed to
   */
  label?: string
}

/**
 * Calm-blue provenance tag shown on AI-generated output. Replaces the
 * pre-S10 alarm-orange "AI-GENERATED — RECRUITER HAS NOT REVIEWED OR EDITED"
 * pattern. Honesty kept (it still says AI); alarm removed.
 *
 * S10 principle: AI is a trusted assistant, not a hazard.
 */
export function AiDraftTag({ label = 'AI draft' }: AiDraftTagProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
      <Sparkles className="h-3 w-3" />
      {label}
    </span>
  )
}
