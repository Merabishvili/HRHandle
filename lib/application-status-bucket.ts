import type { ApplicationStatus } from '@/lib/types/application'

// The candidate-facing status page (G-016) collapses the recruiter-facing
// `application_statuses.code` set into five abstracted buckets. The recruiter
// pipeline names are intentionally hidden from the candidate so the page works
// the same across orgs and never leaks internal terminology.

export const BUCKETS = ['applied', 'in_review', 'interview', 'decision', 'closed'] as const
export type Bucket = (typeof BUCKETS)[number]

export interface BucketView {
  bucket: Bucket
  label: string
  /** Index into BUCKETS for the stepper UI. Always 0..4. */
  stepIndex: number
  /** Terminal buckets ("decision" with hire, "closed") stop the stepper from advancing. */
  isTerminal: boolean
  /** Short explanatory subtitle the candidate sees under the bucket label. */
  subtitle: string
  /** Optional outcome qualifier — only set for terminal hire/withdraw paths so
   * the page can be a tiny bit clearer without spelling out a rejection. */
  outcome: 'hired' | 'withdrawn' | null
}

const BUCKET_LABELS: Record<Bucket, string> = {
  applied: 'Applied',
  in_review: 'In review',
  interview: 'Interview',
  decision: 'Decision',
  closed: 'Closed',
}

const BUCKET_INDEX: Record<Bucket, number> = {
  applied: 0,
  in_review: 1,
  interview: 2,
  decision: 3,
  closed: 4,
}

// i18n keys (the English labels/subtitles above are the source). The candidate
// status page + stepper render these via t() in the org's content language.
export const BUCKET_LABEL_KEY: Record<Bucket, string> = {
  applied: 'status.bucket.applied',
  in_review: 'status.bucket.inReview',
  interview: 'status.bucket.interview',
  decision: 'status.bucket.decision',
  closed: 'status.bucket.closed',
}

const STATUS_SUBTITLE_KEY: Record<string, string> = {
  applied: 'status.subtitle.applied',
  screening: 'status.subtitle.screening',
  interview: 'status.subtitle.interview',
  offer: 'status.subtitle.offer',
  hired: 'status.subtitle.hired',
  rejected: 'status.subtitle.closed',
  withdrawn: 'status.subtitle.withdrawn',
}

/** i18n key for the subtitle of a given raw status code (falls back to applied). */
export function statusSubtitleKey(code: string | null | undefined): string {
  return (code && STATUS_SUBTITLE_KEY[code]) || 'status.subtitle.applied'
}

/** Default view for an application whose `status_id` is NULL — we still show
 * the stepper, just parked at "Applied". Same as a fresh submission. */
export const DEFAULT_BUCKET_VIEW: BucketView = {
  bucket: 'applied',
  label: BUCKET_LABELS.applied,
  stepIndex: BUCKET_INDEX.applied,
  isTerminal: false,
  subtitle: 'We received your application.',
  outcome: null,
}

/** Map a raw status code from the global `application_statuses` table to the
 * candidate-facing bucket view. Unknown codes (defensive — schema is sealed)
 * fall back to "applied" so the page still renders something. */
export function statusCodeToBucket(
  code: ApplicationStatus['code'] | string | null | undefined,
): BucketView {
  switch (code) {
    case 'applied':
      return {
        bucket: 'applied',
        label: BUCKET_LABELS.applied,
        stepIndex: BUCKET_INDEX.applied,
        isTerminal: false,
        subtitle: 'We received your application.',
        outcome: null,
      }
    case 'screening':
      return {
        bucket: 'in_review',
        label: BUCKET_LABELS.in_review,
        stepIndex: BUCKET_INDEX.in_review,
        isTerminal: false,
        subtitle: 'A recruiter is reviewing your application.',
        outcome: null,
      }
    case 'interview':
      return {
        bucket: 'interview',
        label: BUCKET_LABELS.interview,
        stepIndex: BUCKET_INDEX.interview,
        isTerminal: false,
        subtitle: 'Your application is in the interview stage.',
        outcome: null,
      }
    case 'offer':
      return {
        bucket: 'decision',
        label: BUCKET_LABELS.decision,
        stepIndex: BUCKET_INDEX.decision,
        isTerminal: false,
        subtitle:
          'The hiring team is finalising a decision. The recruiter will be in touch directly.',
        outcome: null,
      }
    case 'hired':
      return {
        bucket: 'decision',
        label: BUCKET_LABELS.decision,
        stepIndex: BUCKET_INDEX.decision,
        isTerminal: true,
        subtitle: 'A decision has been reached. The recruiter will follow up directly.',
        outcome: 'hired',
      }
    case 'rejected':
      // Deliberately collapsed to the neutral "Closed" bucket — the page
      // should not deliver a rejection. The recruiter's email confirms.
      return {
        bucket: 'closed',
        label: BUCKET_LABELS.closed,
        stepIndex: BUCKET_INDEX.closed,
        isTerminal: true,
        subtitle:
          'This application has been closed. The recruiter will follow up directly with any next steps.',
        outcome: null,
      }
    case 'withdrawn':
      return {
        bucket: 'closed',
        label: BUCKET_LABELS.closed,
        stepIndex: BUCKET_INDEX.closed,
        isTerminal: true,
        subtitle: 'This application has been withdrawn.',
        outcome: 'withdrawn',
      }
    default:
      return DEFAULT_BUCKET_VIEW
  }
}

/** Ordered list of the four non-terminal buckets — used by the stepper to
 * render the path the candidate is on. "Closed" is handled out-of-band
 * because rejected / withdrawn applications never travel through the
 * "Decision" step in a way the candidate should infer. */
export const STEPPER_BUCKETS: ReadonlyArray<{ bucket: Bucket; label: string }> = [
  { bucket: 'applied', label: BUCKET_LABELS.applied },
  { bucket: 'in_review', label: BUCKET_LABELS.in_review },
  { bucket: 'interview', label: BUCKET_LABELS.interview },
  { bucket: 'decision', label: BUCKET_LABELS.decision },
]
