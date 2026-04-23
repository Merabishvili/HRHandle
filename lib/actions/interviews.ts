'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { InterviewSchema, type InterviewInput } from '@/lib/validations/interview'
import { getValidAccessToken, createCalendarEventWithMeet } from '@/lib/google/calendar'

export async function createInterview(
  input: InterviewInput,
  createMeet = false
): Promise<ActionResult<{ id: string; meetLink: string | null }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = InterviewSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  // Verify the candidate belongs to this org
  const { data: candidate } = await ctx.supabase
    .from('candidates')
    .select('id, first_name, last_name, email')
    .eq('id', parsed.data.candidate_id)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!candidate) return { success: false, error: 'Candidate not found' }

  const { data, error } = await ctx.supabase
    .from('interviews')
    .insert({
      ...parsed.data,
      organization_id: ctx.orgId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'Failed to schedule interview' }

  let meetLink: string | null = null

  if (createMeet && parsed.data.type === 'video') {
    const accessToken = await getValidAccessToken(ctx.userId)

    if (accessToken) {
      // Fetch vacancy title and interviewer email for event details
      const [{ data: vacancy }, { data: interviewer }] = await Promise.all([
        ctx.supabase.from('vacancies').select('title').eq('id', parsed.data.vacancy_id).single(),
        parsed.data.interviewer_id
          ? ctx.supabase.from('profiles').select('email').eq('id', parsed.data.interviewer_id).single()
          : Promise.resolve({ data: null }),
      ])

      const startIso = parsed.data.scheduled_at
      const endIso = new Date(
        new Date(startIso).getTime() + (parsed.data.duration_minutes ?? 60) * 60_000
      ).toISOString()

      const attendeeEmails: string[] = []
      if (interviewer?.email) attendeeEmails.push(interviewer.email)
      if ((candidate as { email?: string | null }).email) attendeeEmails.push((candidate as { email: string }).email)

      const result = await createCalendarEventWithMeet(accessToken, {
        requestId: data.id,
        summary: `Interview: ${candidate.first_name} ${candidate.last_name} — ${vacancy?.title ?? 'Position'}`,
        description: `Interview scheduled via HRHandle.`,
        startIso,
        endIso,
        attendeeEmails,
      })

      meetLink = result.meetLink

      if (result.meetLink || result.eventId) {
        await ctx.supabase
          .from('interviews')
          .update({
            google_meet_link: result.meetLink,
            google_calendar_event_id: result.eventId,
          })
          .eq('id', data.id)
      }
    }
  }

  revalidatePath('/interviews')
  return { success: true, data: { id: data.id, meetLink } }
}
