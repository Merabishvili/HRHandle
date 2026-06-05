import { cn } from '@/lib/utils'

type StatusCode =
  | 'active'
  | 'applied'
  | 'incomplete'
  | 'in_process'
  | 'new'
  | 'hired'
  | 'rejected'
  | 'archived'
  | string

const PILL_STYLES: Record<string, string> = {
  active:     'bg-[oklch(0.65_0.17_145/0.15)] text-[oklch(0.35_0.13_145)]',
  hired:      'bg-[oklch(0.65_0.17_145/0.15)] text-[oklch(0.35_0.13_145)]',
  applied:    'bg-[oklch(0.55_0.18_250/0.15)] text-[oklch(0.35_0.15_250)]',
  incomplete: 'bg-[oklch(0.75_0.15_70/0.2)]  text-[oklch(0.38_0.1_70)]',
  in_process: 'bg-[oklch(0.75_0.15_70/0.2)]  text-[oklch(0.38_0.1_70)]',
  new:        'bg-[oklch(0.7_0.15_165/0.15)]  text-[oklch(0.35_0.12_165)]',
  rejected:   'bg-[oklch(0.577_0.245_27/0.12)] text-[oklch(0.45_0.2_27)]',
  archived:   'bg-[oklch(0.75_0.15_70/0.2)]  text-[oklch(0.38_0.1_70)]',
}

const DEFAULT_STYLE = 'bg-[oklch(0.9_0.01_250)] text-[oklch(0.5_0.02_250)]'

interface StatusPillProps {
  code: StatusCode
  label: string
  className?: string
}

export function StatusPill({ code, label, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-[10px] py-[3px] text-[11.5px] font-semibold leading-none',
        PILL_STYLES[code] ?? DEFAULT_STYLE,
        className
      )}
    >
      {label}
    </span>
  )
}
