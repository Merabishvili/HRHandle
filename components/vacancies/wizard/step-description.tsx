'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AiJdSuggest } from '@/components/vacancies/ai-jd-suggest'
import { AiBiasCheck } from '@/components/vacancies/ai-bias-check'
import { LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'
import { cn } from '@/lib/utils'
import type { JdSection } from '@/lib/ai/jd-generator'

export interface DescriptionState {
  description: string
  responsibilities: string
  requirements: string
  showOnPublicPage: boolean
}

type BodyField = 'description' | 'responsibilities' | 'requirements'

/** Role context the AI assists read at click time (from earlier steps). */
export interface JdContext {
  title: string
  department: string | null
  location: string | null
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null
  sector_name: string | null
}

interface StepDescriptionProps {
  value: DescriptionState
  onChange: (next: DescriptionState) => void
  jdContext: JdContext
  /** Org content languages — when >1, a per-language tab bar appears (Slice 4). */
  orgLocales?: { default: Locale; enabled: Locale[] }
  /** Non-default-locale JD text (the default locale lives in `value`). */
  translations?: Record<string, { description: string; responsibilities: string; requirements: string }>
  onTranslationChange?: (locale: string, field: BodyField, value: string) => void
}

/**
 * Wave 2.7 wizard — Step 3 / Description & AI.
 *
 * Three text areas (about / responsibilities / requirements) plus the
 * public-page toggle. The two AI assists are LIVE during creation: "suggest
 * job description sections" drafts into the fields here (calm pattern: invoke →
 * draft → Apply all → user edits → keep), and "check inclusive language" scans
 * the current text. They also remain available on the vacancy page later.
 *
 * i18n Slice 4 — when the org enables more than one content language, a tab bar
 * lets the recruiter author the JD in each. The default locale is edited in the
 * primary fields (with AI assist + validation); other locales are plain
 * textareas held in `translations`. Parity with the edit form's DetailsSection.
 */
export function StepDescription({
  value,
  onChange,
  jdContext,
  orgLocales = { default: DEFAULT_LOCALE, enabled: [DEFAULT_LOCALE] },
  translations = {},
  onTranslationChange,
}: StepDescriptionProps) {
  const set = <K extends keyof DescriptionState>(key: K, v: DescriptionState[K]) => {
    onChange({ ...value, [key]: v })
  }

  const multiLocale = orgLocales.enabled.length > 1
  const [activeLocale, setActiveLocale] = useState<Locale>(orgLocales.default)
  const isDefault = activeLocale === orgLocales.default
  const tr = translations[activeLocale] ?? { description: '', responsibilities: '', requirements: '' }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-bold text-foreground">Vacancy details</h2>
        <p className="text-[12.5px] text-muted-foreground">
          Shown on the public jobs page and included when sharing on LinkedIn.
        </p>
      </div>

      {multiLocale && (
        <div className="flex flex-wrap gap-1.5">
          {orgLocales.enabled.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setActiveLocale(l)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                activeLocale === l
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-[oklch(0.9_0.01_250)] text-muted-foreground hover:bg-muted',
              )}
            >
              {LOCALE_LABELS[l]}
              {l === orgLocales.default && <span className="ml-1 opacity-60">· default</span>}
            </button>
          ))}
        </div>
      )}

      {isDefault ? (
        <>
          {/* Live AI assists — draft into the default-locale fields below. */}
          <div className="flex flex-col gap-2.5">
            <AiJdSuggest
              getFormSnapshot={() => ({
                title: jdContext.title,
                department: jdContext.department,
                location: jdContext.location,
                employment_type: jdContext.employment_type,
                sector_name: jdContext.sector_name,
              })}
              getExistingFieldText={(section: JdSection) =>
                section === 'description'
                  ? value.description
                  : section === 'responsibilities'
                    ? value.responsibilities
                    : value.requirements
              }
              onApplyAll={(generated) =>
                onChange({
                  ...value,
                  description: generated.description ?? value.description,
                  responsibilities: generated.responsibilities ?? value.responsibilities,
                  requirements: generated.requirements ?? value.requirements,
                })
              }
            />
            <AiBiasCheck
              getFormSnapshot={() => ({
                description: value.description,
                responsibilities: value.responsibilities,
                requirements: value.requirements,
              })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-[11.5px] font-medium text-muted-foreground">
              About the job <span className="text-destructive">*</span>
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
        </>
      ) : (
        // Non-default locale — plain per-locale textareas (optional; the AI
        // assist + validation apply only to the default-locale content above).
        <>
          <div className="space-y-1.5">
            <Label className="text-[11.5px] font-medium text-muted-foreground">About the job</Label>
            <Textarea
              value={tr.description}
              onChange={(e) => onTranslationChange?.(activeLocale, 'description', e.target.value)}
              rows={5}
              maxLength={5000}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11.5px] font-medium text-muted-foreground">Responsibilities</Label>
            <Textarea
              value={tr.responsibilities}
              onChange={(e) => onTranslationChange?.(activeLocale, 'responsibilities', e.target.value)}
              rows={4}
              maxLength={5000}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11.5px] font-medium text-muted-foreground">Requirements</Label>
            <Textarea
              value={tr.requirements}
              onChange={(e) => onTranslationChange?.(activeLocale, 'requirements', e.target.value)}
              rows={4}
              maxLength={5000}
            />
          </div>
        </>
      )}

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
