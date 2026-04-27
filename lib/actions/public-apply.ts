'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendApplicationConfirmationEmail } from '@/lib/email'
import { headers } from 'next/headers'

const MAX_SUBMISSIONS_PER_IP_PER_HOUR = 5
const MAX_APPLICATIONS_PER_VACANCY = 500
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export type PublicApplyResult =
  | { success: true }
  | { success: false; error: string }

export async function submitPublicApplication(
  formData: FormData
): Promise<PublicApplyResult> {
  const supabase = createAdminClient()

  // ── 1. Honeypot ────────────────────────────────────────────────────────────
  const honeypot = formData.get('website') as string | null
  if (honeypot) return { success: true } // silently drop bots

  // ── 2. Read fields ─────────────────────────────────────────────────────────
  const token = formData.get('token') as string | null
  const firstName = (formData.get('first_name') as string | null)?.trim()
  const lastName = (formData.get('last_name') as string | null)?.trim()
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const phone = (formData.get('phone') as string | null)?.trim() || null
  const linkedinUrl = (formData.get('linkedin_profile_url') as string | null)?.trim() || null
  const cvFile = formData.get('cv') as File | null

  // ── 3. Basic validation ────────────────────────────────────────────────────
  if (!token) return { success: false, error: 'Invalid form link.' }
  if (!firstName) return { success: false, error: 'First name is required.' }
  if (!lastName) return { success: false, error: 'Last name is required.' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'A valid email address is required.' }
  }
  if (!cvFile || cvFile.size === 0) return { success: false, error: 'CV upload is required.' }

  // ── 4. File validation (server-side MIME check) ────────────────────────────
  if (!ALLOWED_MIME_TYPES.includes(cvFile.type)) {
    return { success: false, error: 'CV must be a PDF or Word document.' }
  }
  if (cvFile.size > MAX_FILE_BYTES) {
    return { success: false, error: 'CV file must be 10 MB or smaller.' }
  }

  // ── 5. Resolve vacancy from token ─────────────────────────────────────────
  const { data: vacancy } = await supabase
    .from('vacancies')
    .select(`
      id,
      organization_id,
      title,
      archived_at,
      vacancy_statuses ( code )
    `)
    .eq('application_form_token', token)
    .single()

  if (!vacancy) return { success: false, error: 'This apply link is no longer active.' }

  // Vacancy must be active
  const statusCode = (vacancy.vacancy_statuses as any)?.[0]?.code
  if (vacancy.archived_at || statusCode === 'closed' || statusCode === 'archived') {
    return { success: false, error: 'This position is no longer open.' }
  }

  const orgId: string = vacancy.organization_id

  // ── 6. Submission cap per vacancy ─────────────────────────────────────────
  const { count: appCount } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('vacancy_id', vacancy.id)
    .eq('organization_id', orgId)

  if ((appCount ?? 0) >= MAX_APPLICATIONS_PER_VACANCY) {
    return { success: false, error: 'This position is no longer open.' }
  }

  // ── 7. IP rate limiting ────────────────────────────────────────────────────
  const headersList = await headers()
  const ipRaw =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'

  if (ipRaw !== 'unknown') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ipRaw)
      .gte('created_at', oneHourAgo)

    if ((recentCount ?? 0) >= MAX_SUBMISSIONS_PER_IP_PER_HOUR) {
      return { success: false, error: 'Too many submissions. Please try again later.' }
    }
  }

  // ── 8. Duplicate email check ───────────────────────────────────────────────
  const { data: existingCandidate } = await supabase
    .from('candidates')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', email)
    .is('deleted_at', null)
    .single()

  let candidateId: string

  if (existingCandidate) {
    candidateId = existingCandidate.id

    // Check if already applied to this vacancy
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('organization_id', orgId)
      .eq('candidate_id', candidateId)
      .eq('vacancy_id', vacancy.id)
      .is('deleted_at', null)
      .single()

    if (existingApp) {
      return { success: false, error: 'You have already applied for this position.' }
    }
  } else {
    // ── 9. Create new candidate ──────────────────────────────────────────────
    const { data: activeStatus } = await supabase
      .from('candidate_statuses')
      .select('id')
      .eq('code', 'active')
      .single()

    const { data: newCandidate, error: candidateError } = await supabase
      .from('candidates')
      .insert({
        organization_id: orgId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        linkedin_profile_url: linkedinUrl || null,
        source: 'Public Form',
        general_status_id: activeStatus?.id || null,
      })
      .select('id')
      .single()

    if (candidateError || !newCandidate) {
      return { success: false, error: 'Failed to submit application. Please try again.' }
    }

    candidateId = newCandidate.id
  }

  // ── 10. Find "applied" application status ──────────────────────────────────
  const { data: appliedStatus } = await supabase
    .from('application_statuses')
    .select('id')
    .eq('code', 'applied')
    .single()

  // ── 11. Create application ─────────────────────────────────────────────────
  const { error: appError } = await supabase
    .from('applications')
    .insert({
      organization_id: orgId,
      candidate_id: candidateId,
      vacancy_id: vacancy.id,
      status_id: appliedStatus?.id || null,
      ip_address: ipRaw !== 'unknown' ? ipRaw : null,
      source_type: 'public_form',
    })

  if (appError) {
    return { success: false, error: 'Failed to submit application. Please try again.' }
  }

  // ── 12. Upload CV ──────────────────────────────────────────────────────────
  try {
    const fileBytes = await cvFile.arrayBuffer()
    const ext = cvFile.name.split('.').pop() || 'pdf'
    const storagePath = `${orgId}/${candidateId}/${Date.now()}.${ext}`

    const { error: storageError } = await supabase.storage
      .from('candidate-documents')
      .upload(storagePath, fileBytes, {
        contentType: cvFile.type,
        upsert: false,
      })

    if (!storageError) {
      await supabase.from('candidate_documents').insert({
        organization_id: orgId,
        candidate_id: candidateId,
        file_name: cvFile.name,
        file_size: cvFile.size,
        mime_type: cvFile.type,
        storage_path: storagePath,
        document_type: 'cv',
      })
    }
  } catch {
    // CV upload failure is non-fatal — candidate + application already created
  }

  // ── 13. Send confirmation email ────────────────────────────────────────────
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()

    await sendApplicationConfirmationEmail({
      to: email,
      candidateName: `${firstName} ${lastName}`,
      vacancyTitle: vacancy.title,
      organizationName: org?.name || 'the company',
    })
  } catch {
    // Email failure is non-fatal
  }

  return { success: true }
}
