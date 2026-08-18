/**
 * Cross-vacancy kanban — stage colour system (Wave 2.1 Version B).
 *
 * The redesign treats each stage as a hue: pale tint on the column, a darker
 * matching pill in the column header, and a 3px coloured spine on every
 * card so column identity is obvious even when the recruiter is scrolling
 * fast. Aging gets one extra colour — a stale card overrides its spine
 * with amber so the eye picks it out without changing the column tint.
 *
 * Colours come straight from `redesign/Pipeline Versions.dc.html` so the
 * implementation matches the design without an intermediate translation
 * to Tailwind palette tokens. They live here, not inline in components,
 * so the per-stage map is one source of truth — the column, card spine,
 * and pill all read the same row.
 */

import type { ApplicationStatus } from '@/lib/types/application'

export interface StageStyle {
  /** Pale column background. Card sits on this. */
  columnBg: string
  /** Slightly darker column border, same hue. */
  columnBorder: string
  /** Pill background in the column header. */
  pillBg: string
  /** Pill text + the count tabular-num next to it. */
  pillText: string
  /** The 3px card spine — left border of every card in this column. */
  spine: string
}

// Default fallback used for any code we don't have an explicit row for
// (defensive — schema is sealed, but new stages might appear in dev orgs).
const NEUTRAL_STYLE: StageStyle = {
  columnBg: 'oklch(0.97 0.005 250)',
  columnBorder: 'oklch(0.92 0.005 250)',
  pillBg: 'oklch(0.95 0.005 250)',
  pillText: 'oklch(0.45 0.02 250)',
  spine: 'oklch(0.6 0.02 250)',
}

/** Amber override for cards whose `last_status_changed_at` is older than the
 * stale threshold. Applied to the card spine and the time-in-stage label;
 * column tint stays the stage's normal hue. */
export const STALE_SPINE = 'oklch(0.7 0.15 70)'
export const STALE_TEXT = 'oklch(0.5 0.12 70)'

const STAGE_STYLE_MAP: Record<string, StageStyle> = {
  applied: {
    columnBg: 'oklch(0.97 0.02 250)',
    columnBorder: 'oklch(0.91 0.04 250)',
    pillBg: 'oklch(0.93 0.05 250)',
    pillText: 'oklch(0.42 0.16 250)',
    spine: 'oklch(0.55 0.18 250)',
  },
  screening: {
    columnBg: 'oklch(0.97 0.025 95)',
    columnBorder: 'oklch(0.91 0.04 95)',
    pillBg: 'oklch(0.95 0.08 95)',
    pillText: 'oklch(0.48 0.11 80)',
    spine: 'oklch(0.75 0.15 70)',
  },
  interview: {
    columnBg: 'oklch(0.965 0.025 300)',
    columnBorder: 'oklch(0.91 0.04 300)',
    pillBg: 'oklch(0.93 0.06 300)',
    pillText: 'oklch(0.45 0.15 300)',
    spine: 'oklch(0.55 0.15 300)',
  },
  offer: {
    columnBg: 'oklch(0.965 0.025 210)',
    columnBorder: 'oklch(0.91 0.04 210)',
    pillBg: 'oklch(0.94 0.06 200)',
    pillText: 'oklch(0.42 0.12 210)',
    spine: 'oklch(0.6 0.12 210)',
  },
  // Terminal stages render in the right-side rail, not as columns, but
  // their pill colours still need to look themselves on the rail tiles.
  hired: {
    columnBg: 'oklch(0.965 0.03 155)',
    columnBorder: 'oklch(0.9 0.05 155)',
    pillBg: 'oklch(0.93 0.07 155)',
    pillText: 'oklch(0.38 0.14 150)',
    spine: 'oklch(0.55 0.16 150)',
  },
  rejected: {
    columnBg: 'oklch(0.97 0.01 25)',
    columnBorder: 'oklch(0.92 0.02 25)',
    pillBg: 'oklch(0.95 0.04 25)',
    pillText: 'oklch(0.5 0.18 25)',
    spine: 'oklch(0.6 0.2 25)',
  },
  withdrawn: NEUTRAL_STYLE,
}

export function getStageStyle(code: ApplicationStatus['code'] | string | null | undefined): StageStyle {
  if (!code) return NEUTRAL_STYLE
  return STAGE_STYLE_MAP[code] ?? NEUTRAL_STYLE
}

/** Days after which an active application's spine + time label flip to
 * amber. Per design ("5d · stale" in the Applied column example). */
export const STALE_DAYS = 5

/** Stages where the candidate's journey is over. Aging/staleness never
 * applies here — a hired/rejected/withdrawn candidate can't go "stale". */
export const TERMINAL_STAGE_CODES: ReadonlySet<string> = new Set([
  'hired',
  'rejected',
  'withdrawn',
])

export function isTerminalStage(code: string | null | undefined): boolean {
  return !!code && TERMINAL_STAGE_CODES.has(code)
}
