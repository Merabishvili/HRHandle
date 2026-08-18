import { statusLabel } from '@/lib/pipeline/status-i18n'
import type { AuditLogRow } from '@/lib/actions/audit-log'

/** Minimal shape of the next-intl translator we rely on here — callable with
 * optional values, plus `.has()` for the fallback-safe lookups. Keeping it
 * local avoids importing the client hook's type into a shared lib. */
type Translator = {
  (key: string, values?: Record<string, string | number>): string
  has: (key: string) => boolean
}

/** Localized label for an audit entity type, falling back to the raw type. */
export function auditEntityLabel(t: Translator, entityType: string | null): string {
  if (!entityType) return ''
  const key = `auditEntity.${entityType}`
  return t.has(key) ? t(key) : entityType
}

/** Integration platform → brand name (never translated). */
const PROVIDER_LABEL: Record<string, string> = {
  google_calendar: 'Google Calendar',
  microsoft_teams: 'Microsoft Teams',
  zoom: 'Zoom',
  linkedin: 'LinkedIn',
  calendly: 'Calendly',
}

/** A stage/status code → localized label, picking the vacancy-status map for
 * vacancy rows and the application-status map otherwise. */
function stageLabel(t: Translator, entityType: string | null, code: string): string {
  if (entityType === 'vacancy') {
    const key = `vacStatus.${code}`
    return t.has(key) ? t(key) : code
  }
  return statusLabel(t, code, code)
}

/**
 * Render-time localization of an audit row's human-readable "details" text.
 *
 * The DB stores an English `message` composed at write time; we can't
 * re-translate that string, but every row carries a stable `action` code plus
 * structured `details`, so we rebuild a localized phrase here. High-value
 * actions (status transitions, content-locale, imports, integrations, AI
 * assists) are reconstructed from `details`; the rest map to a fixed localized
 * label per action. Anything unmapped falls back to the stored message so a
 * new action code never renders blank.
 */
export function auditMessage(t: Translator, row: AuditLogRow): string {
  const d = (row.details ?? {}) as Record<string, unknown>
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

  switch (row.action) {
    case 'ai_assist': {
      const feature = str(d.feature) ?? 'generic'
      const key = `auditMsg.ai_assist.${feature}`
      return t.has(key) ? t(key) : t('auditMsg.ai_assist.generic')
    }

    case 'ai_fit_invoked':
      return t('auditMsg.aiFit')

    case 'status_changed': {
      const before = str(d.before)
      const after = str(d.after)
      if (before && after) {
        return t('auditMsg.statusChanged', {
          from: stageLabel(t, row.entity_type, before),
          to: stageLabel(t, row.entity_type, after),
        })
      }
      return row.message ?? ''
    }

    case 'status_change_email_sent': {
      const stage = str(d.stage)
      return stage
        ? t('auditMsg.statusEmailSent', { stage: stageLabel(t, row.entity_type, stage) })
        : (row.message ?? '')
    }

    case 'org_content_locale_updated': {
      const def = str(d.default_content_locale) ?? ''
      const enabled = Array.isArray(d.enabled_content_locales)
        ? (d.enabled_content_locales as unknown[]).map(String).join(', ')
        : ''
      return t('auditMsg.contentLocale', { default: def, enabled })
    }

    case 'candidates_imported': {
      const count = typeof d.rows_imported === 'number' ? d.rows_imported : 0
      return t('auditMsg.candidatesImported', { count })
    }

    case 'connected':
      return t('auditMsg.integrationConnected', {
        provider: PROVIDER_LABEL[str(d.platform) ?? ''] ?? str(d.platform) ?? '',
      })

    case 'disconnected':
      return t('auditMsg.integrationDisconnected', {
        provider: PROVIDER_LABEL[str(d.platform) ?? ''] ?? str(d.platform) ?? '',
      })

    default: {
      const key = `auditMsg.action.${row.action}`
      return t.has(key) ? t(key) : (row.message ?? '')
    }
  }
}
