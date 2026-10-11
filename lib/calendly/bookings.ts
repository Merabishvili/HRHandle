import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A candidate cancelled the Calendly booking they made through an HRHandle
 * link: cancel the interview that booking created. The booking stored nothing
 * Calendly-specific on the interview, so it's matched by the application and
 * the booked start time (a reschedule arrives as a cancel + a new booking, so
 * only the old slot's interview is cancelled). Returns how many interviews
 * were cancelled — 0 when HRHandle never recorded the booking.
 */
export async function cancelBookedInterview(
  admin: SupabaseClient,
  applicationId: string,
  startTime: string | null | undefined,
): Promise<number> {
  if (!startTime) return 0
  const { data, error } = await admin
    .from('interviews')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('application_id', applicationId)
    .eq('scheduled_at', startTime)
    .eq('status', 'scheduled')
    .select('id')
  if (error) {
    console.error('[calendly-webhook] cancelling the interview failed:', error.message)
    return 0
  }
  return data?.length ?? 0
}
