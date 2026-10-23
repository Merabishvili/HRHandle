import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { retainUntil } from '@/lib/billing/payment-records'

/**
 * Register of personal-data disclosures (`public.data_disclosures`, migration
 * 20261023_payment_records.sql): which personal data HRHandle handed to whom,
 * when, why and on what legal basis — kept as long as the data itself. The
 * merchant agreement and Georgian data-protection law both ask for this log.
 *
 * Covers disclosures HRHandle makes as a controller (e.g. the payer's email to
 * the payment provider at checkout, an answer to an authority's request).
 * A customer's own sharing (scorecard links) is in the audit log instead.
 * Ad-hoc entries: `node scripts/record-disclosure.mjs` (see docs/9-compliance).
 */
export type LegalBasis =
  | 'contract'
  | 'legal_obligation'
  | 'consent'
  | 'legitimate_interest'
  | 'vital_interest'
  | 'public_task'

export interface DisclosureEntry {
  orgId: string | null
  subjectType: 'payer' | 'member' | 'candidate' | 'other'
  subjectRef?: string | null
  dataCategories: string[]
  recipient: string
  purpose: string
  legalBasis: LegalBasis
  relatedRef?: string | null
  recordedBy?: string | null
  /** When the data's own retention ends; defaults to 5 years from now. */
  retainUntil?: Date
}

/** Best-effort, like writeAuditLog: a failure is reported, never thrown. */
export async function recordDisclosure(entry: DisclosureEntry): Promise<void> {
  try {
    const admin = createAdminClient()
    const now = new Date()
    const { error } = await admin.from('data_disclosures').insert({
      organization_id: entry.orgId,
      subject_type: entry.subjectType,
      subject_ref: entry.subjectRef ?? null,
      data_categories: entry.dataCategories,
      recipient: entry.recipient,
      purpose: entry.purpose,
      legal_basis: entry.legalBasis,
      related_ref: entry.relatedRef ?? null,
      recorded_by: entry.recordedBy ?? null,
      disclosed_at: now.toISOString(),
      retain_until: (entry.retainUntil ?? retainUntil(now)).toISOString(),
    })
    if (error) {
      console.error('[data-disclosures] insert failed:', error.message)
      Sentry.captureException(new Error(`data-disclosures insert failed: ${error.message}`), {
        tags: { feature: 'data_disclosures' },
      })
    }
  } catch (err) {
    console.error('[data-disclosures] unexpected error:', err)
    Sentry.captureException(err, { tags: { feature: 'data_disclosures' } })
  }
}
