'use client'

import { Sparkles } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export interface DescriptionState {
  description: string
  responsibilities: string
  requirements: string
  showOnPublicPage: boolean
}

interface StepDescriptionProps {
  value: DescriptionState
  onChange: (next: DescriptionState) => void
}

/**
 * Wave 2.7 wizard — Step 3 / Description & AI per Create Vacancy
 * Steps.dc.html.
 *
 * Three text areas (about / responsibilities / requirements) plus the
 * public-page toggle. The two AI affordances (suggest sections + bias
 * check) are shown as calm-blue dashed tiles that link out to the full
 * AI panels on the vacancy detail page after creation — inlining them
 * here would make the wizard considerably larger and the AI components
 * have their own state machines (tech-debt.md §2 covers AiDraftPanel
 * adoption). The wizard primary flow is text entry; AI assist remains
 * available post-create.
 */
export function StepDescription({ value, onChange }: StepDescriptionProps) {
  const set = <K extends keyof DescriptionState>(key: K, v: DescriptionState[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-bold text-foreground">Vacancy details</h2>
        <p className="text-[12.5px] text-muted-foreground">
          Shown on the public jobs page and included when sharing on LinkedIn.
        </p>
      </div>

      {/* AI assist hint tiles */}
      <div className="flex flex-col gap-2">
        <AiHint label="AI assist — suggest job description sections" />
        <AiHint label="AI assist — check inclusive language" />
      </div>
      <p className="text-[11px] leading-[1.45] text-muted-foreground">
        Both AI panels are available on the vacancy page after you create — they save back to the
        same fields shown below.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-[11.5px] font-medium text-muted-foreground">
          About the job <span className="text-destructive">*</span>
          <span className="ml-1 text-muted-foreground/70">— required for publish</span>
        </Label>
        <Textarea
          id="description"
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
          rows={5}
          maxLength={5000}
          placeholder="Give an overview of the role — what the team does, what success looks like, and why someone would want to join."
        />
        <p className="text-right text-[11px] text-muted-foreground/80">{value.description.length} / 5000</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="responsibilities" className="text-[11.5px] font-medium text-muted-foreground">
          Responsibilities
        </Label>
        <Textarea
          id="responsibilities"
          value={value.responsibilities}
          onChange={(e) => set('responsibilities', e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="• Lead… • Collaborate… • Mentor…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="requirements" className="text-[11.5px] font-medium text-muted-foreground">
          Requirements
        </Label>
        <Textarea
          id="requirements"
          value={value.requirements}
          onChange={(e) => set('requirements', e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="• 5+ years… • Strong understanding of…"
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[oklch(0.92_0.01_250)] px-3.5 py-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Show on public jobs page</p>
          <p className="text-[11.5px] text-muted-foreground">
            Candidates can discover and apply from your public jobs page.
          </p>
        </div>
        <Switch
          checked={value.showOnPublicPage}
          onCheckedChange={(checked) => set('showOnPublicPage', checked)}
          aria-label="Show on public jobs page"
        />
      </div>
    </div>
  )
}

function AiHint({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-dashed border-[oklch(0.82_0.06_250)] bg-[oklch(0.985_0.012_250)] px-3.5 py-2.5">
      <Sparkles className="h-3.5 w-3.5 text-[oklch(0.45_0.16_250)]" aria-hidden />
      <span className="flex-1 text-[12.5px] font-semibold text-foreground/80">{label}</span>
      <span className="rounded bg-[oklch(0.93_0.05_250)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[oklch(0.42_0.16_250)]">
        After create
      </span>
    </div>
  )
}
