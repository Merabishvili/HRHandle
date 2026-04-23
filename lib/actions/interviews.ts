'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { InterviewSchema, type InterviewInput } from '@/lib/validations/interview'
import { getValidAccessToken, createCalendarEventWithMeet } from '@/lib/google/calendar'
import { getValidZoomAccessToken, createZoomMeeting } from '@/lib/zoom/meetings'
import { sendInterviewInvitationEmail } from '@/lib/email'

export async function createInterview(
  input: InterviewInput,
  options: {
    createMeet?: boolean
    createZoom?: boolean
    meetingLink?: string | null
    sendInvitation?: boolean
  } = {}
): Promise<ActionResult<{ id: string; meetLink: string | null }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = InterviewSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { data: candidate } = await ctx.supabase
    .from('candidates')
    .select('id, first_name, last_name, email')
    .eq('id', parsed.data.candidate_id)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!candidate) return { success: false, error: 'Candidate not found' }

  const manualLink = options.meetingLink?.trim() || null

  const { data, error } = await ctx.supabase
    .from('interviews')
    .insert({
      ...parsed.data,
      organization_id: ctx.orgId,
      meeting_link: manualLink,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'Failed to schedule interview' }

  let meetLink: string | null = manualLink

  // Google Meet
  if (options.createMeet && parsed.data.type === 'video') {
    const accessToken = await getValidAccessToken(ctx.userId)

    if (accessToken) {
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
      if ((candidate as { email?: string | null }).email)
        attendeeEmails.push((candidate as { email: string }).email)

      const result = await createCalendarEventWithMeet(accessToken, {
        requestId: data.id,
        summary: `Interview: ${candidate.first_name} ${candidate.last_name} — ${vacancy?.title ?? 'Position'}`,
        description: `Interview scheduled via HRHandle.`,
        startIso,
        endIso,
        attendeeEmails,
      })

      if (result.meetLink || result.eventId) {
        await ctx.supabase
          .from('interviews')
          .update({
            google_meet_link: result.meetLink,
            google_calendar_event_id: result.eventId,
          })
          .eq('id', data.id)
        meetLink = result.meetLink
      }
    }
  }

  // Zoom
  if (options.createZoom && parsed.data.type === 'video') {
    const accessToken = await getValidZoomAccessToken(ctx.userId)

    if (accessToken) {
      const { data: vacancy } = await ctx.supabase
        .from('vacancies')
        .select('title')
        .eq('id', parsed.data.vacancy_id)
        .single()

      const result = await createZoomMeeting(accessToken, {
        topic: `Interview: ${candidate.first_name} ${candidate.last_name} — ${vacancy?.title ?? 'Position'}`,
        startIso: parsed.data.scheduled_at,
        durationMinutes: parsed.data.duration_minutes ?? 60,
      })

      if (result) {
        await ctx.supabase
          .from('interviews')
          .update({ meeting_link: result.joinUrl })
          .eq('id', data.id)
        meetLink = result.joinUrl
      }
    }
  }

  // Email invitation
  if (options.sendInvitation) {
    const candidateEmail = (candidate as { email?: string | null }).email
    if (candidateEmail) {
      try {
        const { data: senderProfile } = await ctx.supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', ctx.userId)
          .single()

        const { data: vacancy } = await ctx.supabase
          .from('vacancies')
          .select('title')
          .eq('id', parsed.data.vacancy_id)
          .single()

        await sendInterviewInvitationEmail({
          to: candidateEmail,
          candidateName: `${candidate.first_name} ${candidate.last_name}`,
          senderName: senderProfile?.full_name ?? 'The hiring team',
          senderEmail: senderProfile?.email ?? 'noreply@hrhandle.com',
          vacancyTitle: vacancy?.title ?? 'Position',
          scheduledAt: parsed.data.scheduled_at,
          durationMinutes: parsed.data.duration_minutes ?? 60,
          interviewType: parsed.data.type,
          meetingLink: meetLink,
        })
      } catch {
        // Email failure is non-fatal — interview was already created
      }
    }
  }

  revalidatePath('/interviews')
  return { success: true, data: { id: data.id, meetLink } }
}
