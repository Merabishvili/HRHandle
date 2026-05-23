'use server'

import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { InterviewSchema, type InterviewInput } from '@/lib/validations/interview'
import { getValidAccessToken, createCalendarEventWithMeet, deleteCalendarEvent } from '@/lib/google/calendar'
import { getValidZoomAccessToken, createZoomMeeting, deleteZoomMeeting, parseZoomMeetingIdFromJoinUrl } from '@/lib/zoom/meetings'
import { getValidMicrosoftAccessToken, createTeamsMeeting } from '@/lib/microsoft/graph'
import { sendInterviewInvitationEmail } from '@/lib/email'
import { createOrgNotifications } from '@/lib/actions/notifications'

export async function updateInterviewStatus(
  interviewId: string,
  status: 'cancelled' | 'no_show' | 'completed'
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // BL-010: when an interview is cancelled, delete the external calendar
  // event / video meeting so it doesn't linger on the interviewer's calendar
  // or in Zoom. Best-effort — failure to clean up does not block the status
  // update.
  if (status === 'cancelled') {
    const { data: interview } = await ctx.supabase
      .from('interviews')
      .select('google_calendar_event_id, meeting_link, interviewer_id')
      .eq('id', interviewId)
      .eq('organization_id', ctx.orgId)
      .single()

    if (interview) {
      const cleanupUserId = interview.interviewer_id ?? ctx.userId

      if (interview.google_calendar_event_id) {
        try {
          const googleToken = await getValidAccessToken(cleanupUserId)
          if (googleToken) {
            await deleteCalendarEvent(googleToken, interview.google_calendar_event_id as string)
          }
        } catch (err) {
          console.error('[interviews] Google calendar event delete failed:', err)
          Sentry.captureException(err, { tags: { area: 'interviews', op: 'cancel_google_cleanup' } })
        }
      }

      const zoomMeetingId = parseZoomMeetingIdFromJoinUrl(interview.meeting_link as string | null)
      if (zoomMeetingId) {
        try {
          const zoomToken = await getValidZoomAccessToken(cleanupUserId)
          if (zoomToken) {
            await deleteZoomMeeting(zoomToken, zoomMeetingId)
          }
        } catch (err) {
          console.error('[interviews] Zoom meeting delete failed:', err)
          Sentry.captureException(err, { tags: { area: 'interviews', op: 'cancel_zoom_cleanup' } })
        }
      }
    }
  }

  const { error } = await ctx.supabase
    .from('interviews')
    .update({ status })
    .eq('id', interviewId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update interview status' }

  revalidatePath('/interviews')
  return { success: true, data: undefined }
}

export async function rescheduleInterview(
  interviewId: string,
  scheduledAt: string,
  durationMinutes: number,
  sendEmail: boolean,
  timezone?: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const scheduledDate = new Date(scheduledAt)
  if (Number.isNaN(scheduledDate.getTime())) return { success: false, error: 'Invalid date/time' }
  const now = new Date()
  if (scheduledDate <= now) return { success: false, error: 'Interview must be in the future' }

  const { data: interview, error: fetchErr } = await ctx.supabase
    .from('interviews')
    .select('id, candidate_id, vacancy_id, type, meeting_link, google_meet_link')
    .eq('id', interviewId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (fetchErr || !interview) return { success: false, error: 'Interview not found' }

  const { error } = await ctx.supabase
    .from('interviews')
    .update({ scheduled_at: scheduledAt, duration_minutes: durationMinutes, status: 'scheduled' })
    .eq('id', interviewId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to reschedule interview' }

  if (sendEmail) {
    try {
      // allSettled so a transient failure on one fetch (e.g. the inviter
      // profile) doesn't cancel the whole email send — fallbacks handle
      // the missing parts (audit P-004).
      const [candidateRes, vacancyRes, senderRes] = await Promise.allSettled([
        ctx.supabase.from('candidates').select('first_name, last_name, email').eq('id', interview.candidate_id).eq('organization_id', ctx.orgId).single(),
        ctx.supabase.from('vacancies').select('title').eq('id', interview.vacancy_id).eq('organization_id', ctx.orgId).single(),
        ctx.supabase.from('profiles').select('full_name, email').eq('id', ctx.userId).single(),
      ])
      const candidate = candidateRes.status === 'fulfilled' ? candidateRes.value.data : null
      const vacancy = vacancyRes.status === 'fulfilled' ? vacancyRes.value.data : null
      const senderProfile = senderRes.status === 'fulfilled' ? senderRes.value.data : null

      if (candidate?.email) {
        const meetLink = interview.google_meet_link || interview.meeting_link || null
        await sendInterviewInvitationEmail({
          to: candidate.email,
          candidateName: `${candidate.first_name} ${candidate.last_name}`,
          senderName: senderProfile?.full_name ?? 'The hiring team',
          senderEmail: senderProfile?.email ?? 'noreply@hrhandle.com',
          vacancyTitle: vacancy?.title ?? 'Position',
          scheduledAt,
          durationMinutes,
          interviewType: interview.type,
          meetingLink: meetLink,
          rescheduled: true,
          timezone,
        })
      }
    } catch (err) {
      console.error('[interviews] reschedule email send failed:', err)
      Sentry.captureException(err, { tags: { area: 'interviews', op: 'reschedule_email' } })
    }
  }

  revalidatePath('/interviews')
  return { success: true, data: undefined }
}

export async function createInterview(
  input: InterviewInput,
  options: {
    createMeet?: boolean
    createZoom?: boolean
    createTeams?: boolean
    meetingLink?: string | null
    sendInvitation?: boolean
    timezone?: string
  } = {}
): Promise<ActionResult<{ id: string; meetLink: string | null; warnings: string[] }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = InterviewSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  // Non-fatal failures (email, notification) are collected here so the caller
  // can surface them as toasts after the interview is already saved.
  const warnings: string[] = []

  const { data: candidate } = await ctx.supabase
    .from('candidates')
    .select('id, first_name, last_name, email')
    .eq('id', parsed.data.candidate_id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
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
      // allSettled so a missing interviewer profile or vacancy title doesn't
      // block Meet/Teams creation — we fall back to defaults (audit P-004).
      const [vacancyRes, interviewerRes] = await Promise.allSettled([
        ctx.supabase.from('vacancies').select('title').eq('id', parsed.data.vacancy_id).eq('organization_id', ctx.orgId).single(),
        parsed.data.interviewer_id
          ? ctx.supabase.from('profiles').select('email').eq('id', parsed.data.interviewer_id).eq('organization_id', ctx.orgId).single()
          : Promise.resolve({ data: null }),
      ])
      const vacancy = vacancyRes.status === 'fulfilled' ? vacancyRes.value.data : null
      const interviewer = interviewerRes.status === 'fulfilled' ? interviewerRes.value.data : null

      const startIso = parsed.data.scheduled_at
      const endIso = new Date(
        new Date(startIso).getTime() + (parsed.data.duration_minutes ?? 60) * 60_000
      ).toISOString()

      const attendeeEmails: string[] = []
      if (interviewer?.email) attendeeEmails.push(interviewer.email)
      if (candidate.email)
        attendeeEmails.push(candidate.email)

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
          .eq('organization_id', ctx.orgId)
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
        .eq('organization_id', ctx.orgId)
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
          .eq('organization_id', ctx.orgId)
        meetLink = result.joinUrl
      }
    }
  }

  // Microsoft Teams
  if (options.createTeams && parsed.data.type === 'video') {
    const accessToken = await getValidMicrosoftAccessToken(ctx.userId)

    if (accessToken) {
      // allSettled so a missing interviewer profile or vacancy title doesn't
      // block Meet/Teams creation — we fall back to defaults (audit P-004).
      const [vacancyRes, interviewerRes] = await Promise.allSettled([
        ctx.supabase.from('vacancies').select('title').eq('id', parsed.data.vacancy_id).eq('organization_id', ctx.orgId).single(),
        parsed.data.interviewer_id
          ? ctx.supabase.from('profiles').select('email').eq('id', parsed.data.interviewer_id).eq('organization_id', ctx.orgId).single()
          : Promise.resolve({ data: null }),
      ])
      const vacancy = vacancyRes.status === 'fulfilled' ? vacancyRes.value.data : null
      const interviewer = interviewerRes.status === 'fulfilled' ? interviewerRes.value.data : null

      const startIso = parsed.data.scheduled_at
      const endIso = new Date(
        new Date(startIso).getTime() + (parsed.data.duration_minutes ?? 60) * 60_000
      ).toISOString()

      const attendeeEmails: string[] = []
      if (interviewer?.email) attendeeEmails.push(interviewer.email)
      if (candidate.email)
        attendeeEmails.push(candidate.email)

      const result = await createTeamsMeeting(accessToken, {
        summary: `Interview: ${candidate.first_name} ${candidate.last_name} — ${vacancy?.title ?? 'Position'}`,
        description: 'Interview scheduled via HRHandle.',
        startIso,
        endIso,
        attendeeEmails,
      })

      if (result.teamsLink || result.eventId) {
        await ctx.supabase
          .from('interviews')
          .update({
            meeting_link: result.teamsLink,
            microsoft_calendar_event_id: result.eventId,
          })
          .eq('id', data.id)
          .eq('organization_id', ctx.orgId)
        meetLink = result.teamsLink
      }
    }
  }

  // Email invitation
  if (options.sendInvitation) {
    const candidateEmail = candidate.email
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
          .eq('organization_id', ctx.orgId)
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
          timezone: options.timezone,
        })
      } catch (err) {
        console.error('[interviews] email send failed:', err)
        Sentry.captureException(err, { tags: { area: 'interviews', op: 'invitation_email' } })
        warnings.push('email_failed')
      }
    }
  }

  // Notify the interviewer (if assigned) and the creator
  try {
    const { data: vacancy } = await ctx.supabase
      .from('vacancies')
      .select('title')
      .eq('id', parsed.data.vacancy_id)
      .eq('organization_id', ctx.orgId)
      .single()

    const recipientIds = new Set<string>()
    recipientIds.add(ctx.userId)
    if (parsed.data.interviewer_id && parsed.data.interviewer_id !== ctx.userId) {
      recipientIds.add(parsed.data.interviewer_id)
    }

    await createOrgNotifications(ctx.orgId, [...recipientIds], {
      type: 'interview_scheduled',
      title: `Interview scheduled: ${candidate.first_name} ${candidate.last_name}`,
      body: vacancy?.title ? `For ${vacancy.title}` : undefined,
      link: `/interviews`,
    })
  } catch (err) {
    // Non-fatal: interview was created. Surface the error so we can debug.
    console.error('[interviews] post-create notification failed:', err)
    Sentry.captureException(err, { tags: { area: 'interviews', op: 'post_create_notification' } })
  }

  revalidatePath('/interviews')
  revalidatePath(`/candidates/${parsed.data.candidate_id}`)
  return { success: true, data: { id: data.id, meetLink, warnings } }
}
