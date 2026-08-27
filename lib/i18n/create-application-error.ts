import { MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE } from '@/lib/types/constants'

/**
 * Localize a failed `createApplication()` result for display in the
 * add-to-vacancy dialogs. The server action returns English `error` strings
 * (useful for logs); the machine `code` is mapped to a translated message here,
 * falling back to the raw string for any unmapped failure.
 */
export function createApplicationErrorMessage(
  t: (key: string, values?: Record<string, string | number>) => string,
  result: { error: string; code?: string },
): string {
  switch (result.code) {
    case 'DUPLICATE_APPLICATION':
      return t('addApp.errDuplicate')
    case 'ACTIVE_LIMIT':
      return t('addApp.atLimit', { max: MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE })
    case 'CANDIDATE_INACTIVE':
      return t('addApp.errInactive')
    default:
      return result.error
  }
}
