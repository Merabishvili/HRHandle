'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Lock, Mail, Video } from 'lucide-react'

export function EmailToggle({
  id,
  checked,
  onChange,
  disabled,
  candidateHasEmail,
  showNoEmailHint,
  className,
}: {
  id: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled: boolean
  candidateHasEmail: boolean
  showNoEmailHint: boolean
  className?: string
}) {
  const t = useTranslations()
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={`flex items-center gap-2 text-[12.5px] font-medium ${candidateHasEmail ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || !candidateHasEmail}
          className="h-4 w-4 rounded border-border"
        />
        <Mail className="h-3.5 w-3.5 text-primary" />
        {t('interviews.form.emailCandidate')}
      </label>
      {showNoEmailHint && (
        <p className="mt-1 pl-7 text-[11px] text-muted-foreground">
          {t('interviews.form.noEmailOnFile')}
        </p>
      )}
    </div>
  )
}

/** Type segmented-control button — equal-width tile with icon + label.
 * Active state uses the brand-blue tinted background per the design. */
export function TypeSegment({
  active,
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  active: boolean
  icon: typeof Video
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="radio"
      aria-checked={active}
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50',
        active
          ? 'border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)] text-[oklch(0.2_0.16_250)]'
          : 'border-border bg-white text-foreground/80 hover:bg-muted/40',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  )
}

/** Read-only field — used to show a derived/locked value (candidate, vacancy)
 * with a small lock affordance, styled like a disabled input. */
export function LockedField({ value, hint }: { value: string; hint?: string | undefined }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm">
      <span className="truncate font-medium text-foreground">{value}</span>
      {hint && (
        <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">{hint}</span>
      )}
      <Lock
        className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', hint ? '' : 'ml-auto')}
        aria-hidden
      />
    </div>
  )
}

export function MeetChip({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-50',
        active
          ? 'border-[oklch(0.55_0.18_250)] bg-[oklch(0.93_0.05_250)] text-[oklch(0.45_0.16_250)]'
          : 'border-border bg-white text-foreground/70 hover:bg-muted/40',
      )}
    >
      {label}
    </button>
  )
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-semibold text-foreground/85" title={value}>
        {value}
      </span>
    </li>
  )
}
