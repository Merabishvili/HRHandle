import { auditMessage } from '@/lib/audit-log/message-i18n'
import type { AuditLogRow } from '@/lib/actions/audit-log'

/** Minimal shape of the next-intl translator — callable with optional values
 * plus `.has()` for fallback-safe lookups. Local to avoid pulling the client
 * hook's type into a shared lib. */
type Translator = {
  (key: string, values?: Record<string, string | number>): string
  has: (key: string) => boolean
}

/** Structured `params` appended to each `candidate_activity` row by
 * `20260820_candidate_activity_i18n_params.sql`. Every field is optional — a
 * row (or a pre-migration read) may carry none, in which case the caller falls
 * back to the stored English headline. */
export interface ActivityParams {
  /** application — vacancy title. */
  title?: string
  /** document — uploaded file name. */
  file?: string
  /** document — document type (org-defined; shown as-is). */
  docType?: string | null
  /** interview — raw type code (phone/video/onsite). */
  type?: string
  /** interview — scheduled timestamp (ISO), formatted per-locale in the view. */
  at?: string
  /** stage/offer — reconstruct via the audit-log localizer. */
  audit?: boolean
  action?: string
  entity_type?: string | null
  details?: Record<string, unknown> | null
}

const INTERVIEW_TYPE_KEY: Record<string, string> = {
  phone: 'interviews.form.typePhone',
  video: 'interviews.form.typeVideo',
  onsite: 'interviews.form.typeOnsite',
}

/** Localized interview-type label (Phone / Video / On-site), falling back to a
 * capitalized raw code for any unmapped type. */
export function interviewTypeLabel(t: Translator, type: string | undefined | null): string {
  if (!type) return ''
  const key = INTERVIEW_TYPE_KEY[type]
  if (key) return t(key)
  return type.charAt(0).toUpperCase() + type.slice(1)
}

/**
 * Render-time localization of a `candidate_activity` headline. Rebuilds the
 * phrase from `kind` + structured `params`; stage/offer rows delegate to the
 * shared audit-log localizer. Falls back to the stored English `headline`
 * whenever `params` is missing (pre-migration) or a kind is unrecognized, so
 * the feed can never render blank.
 */
export function activityHeadline(
  t: Translator,
  kind: string,
  headline: string,
  params: ActivityParams | null | undefined,
): string {
  const p = params ?? {}
  switch (kind) {
    case 'application':
      return p.title != null ? t('activity.appliedTo', { title: p.title }) : headline
    case 'note':
      return t('activity.noteAdded')
    case 'document':
      return p.file != null ? t('activity.documentUploaded', { file: p.file }) : headline
    case 'interview':
      return p.type != null
        ? t('activity.interviewScheduled', { type: interviewTypeLabel(t, p.type) })
        : headline
    case 'stage':
    case 'offer':
      if (p.audit && p.action) {
        return auditMessage(t, {
          action: p.action,
          entity_type: p.entity_type ?? null,
          details: p.details ?? null,
          message: headline,
        } as unknown as AuditLogRow)
      }
      return headline
    default:
      return headline
  }
}
