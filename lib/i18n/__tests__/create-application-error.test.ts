import { describe, it, expect } from 'vitest'

import { createApplicationErrorMessage } from '@/lib/i18n/create-application-error'
import { MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE } from '@/lib/types/constants'

// Fake `t` that echoes the key + interpolated params so we can assert which
// message key (and values) the helper selected without loading real bundles.
const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${JSON.stringify(values)})` : key

describe('createApplicationErrorMessage', () => {
  it('maps DUPLICATE_APPLICATION to the localized duplicate key', () => {
    expect(
      createApplicationErrorMessage(t, { error: 'raw english', code: 'DUPLICATE_APPLICATION' }),
    ).toBe('addApp.errDuplicate')
  })

  it('maps CANDIDATE_INACTIVE to the localized inactive key', () => {
    expect(
      createApplicationErrorMessage(t, { error: 'raw english', code: 'CANDIDATE_INACTIVE' }),
    ).toBe('addApp.errInactive')
  })

  it('maps ACTIVE_LIMIT to the at-limit key with the max count', () => {
    expect(createApplicationErrorMessage(t, { error: 'raw english', code: 'ACTIVE_LIMIT' })).toBe(
      `addApp.atLimit(${JSON.stringify({ max: MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE })})`,
    )
  })

  it('falls back to the raw error string for unmapped / missing codes', () => {
    expect(createApplicationErrorMessage(t, { error: 'Failed to create application.' })).toBe(
      'Failed to create application.',
    )
    expect(
      createApplicationErrorMessage(t, { error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }),
    ).toBe('Not authenticated')
  })
})
