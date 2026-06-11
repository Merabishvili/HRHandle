// Pure state machine for an offer (G-018). Lives outside lib/actions/ so it
// can be unit-tested without spinning up Supabase, and so both server actions
// and the recruiter UI agree on what transitions are legal.

export const OFFER_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
  'withdrawn',
] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]

export const TERMINAL_STATUSES: ReadonlySet<OfferStatus> = new Set<OfferStatus>([
  'accepted',
  'declined',
  'expired',
  'withdrawn',
])

export function isTerminal(status: OfferStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

/** Whether a recruiter can edit the offer's fields. Once it's been sent the
 * candidate is looking at the same content — editing would silently change
 * what they see when they refresh. To revise, withdraw and create a new one. */
export function canEdit(status: OfferStatus): boolean {
  return status === 'draft'
}

/** Whether the Send button should be enabled. */
export function canSend(status: OfferStatus): boolean {
  return status === 'draft'
}

/** Whether the recruiter can pull a live offer back. */
export function canWithdraw(status: OfferStatus): boolean {
  return status === 'sent'
}

/** Whether the candidate-facing page should still show Accept/Decline. */
export function canRespond(status: OfferStatus): boolean {
  return status === 'sent'
}

export const COMPENSATION_PERIODS = [
  'annual',
  'monthly',
  'hourly',
  'project',
  'other',
] as const
export type CompensationPeriod = (typeof COMPENSATION_PERIODS)[number]

export const COMPENSATION_PERIOD_LABELS: Record<CompensationPeriod, string> = {
  annual: 'per year',
  monthly: 'per month',
  hourly: 'per hour',
  project: 'per project',
  other: '',
}
