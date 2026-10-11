/** Longest withdrawal reason we keep (the candidate's dialog allows the same). */
export const WITHDRAWAL_REASON_MAX = 1000

/**
 * The reason a candidate typed when withdrawing, cleaned for storage: trimmed,
 * capped at {@link WITHDRAWAL_REASON_MAX} characters, or null when empty. It's
 * shown to the owner and admins (notification, audit log, activity feed).
 */
export function withdrawalReason(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim()
  return text ? text.slice(0, WITHDRAWAL_REASON_MAX) : null
}
