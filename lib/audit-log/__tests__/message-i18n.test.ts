import { describe, it, expect } from 'vitest'
import { auditActionLabel, auditMessage } from '@/lib/audit-log/message-i18n'
import type { AuditLogRow } from '@/lib/actions/audit-log'

// Echo translator: "key|param=value", and every key "exists".
const t = Object.assign(
  (key: string, values?: Record<string, string | number>) =>
    values ? `${key}|${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(',')}` : key,
  { has: () => true },
)

const row = (details: Record<string, unknown>) =>
  ({ action: 'application_withdrawn', entity_type: 'application', details, message: 'application withdrawn by candidate' }) as unknown as AuditLogRow

describe('auditMessage — candidate withdrawal', () => {
  it('includes the reason the candidate gave', () => {
    expect(auditMessage(t, row({ reason: 'Took another offer' }))).toBe('auditMsg.withdrawnWithReason|reason=Took another offer')
  })

  it('falls back to the plain phrase without a reason', () => {
    expect(auditMessage(t, row({ has_reason: false }))).toBe('auditMsg.action.application_withdrawn')
  })
})

describe('auditMessage — Georgian residency declaration', () => {
  const declared = (resident: boolean) =>
    ({ action: 'billing_residency_declared', entity_type: 'organization', details: { resident }, message: '' }) as unknown as AuditLogRow

  it('says which answer was given', () => {
    expect(auditMessage(t, declared(true))).toBe('auditMsg.residencyResident')
    expect(auditMessage(t, declared(false))).toBe('auditMsg.residencyNonResident')
  })
})

describe('auditActionLabel', () => {
  it('uses the translated name of a known action', () => {
    expect(auditActionLabel(t, 'offer_sent')).toBe('auditAction.offer_sent')
  })

  it('turns an unknown code into words instead of showing the raw code', () => {
    const none = Object.assign((key: string) => key, { has: () => false })
    expect(auditActionLabel(none, 'some_new_action')).toBe('Some new action')
  })
})
