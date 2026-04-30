'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendApplicationConfirmationEmail } from '@/lib/email'
import { createOrgNotifications } from '@/lib/actions/notifications'
import { headers } from 'next/headers'

const MAX_SUBMISSIONS_PER_IP_PER_HOUR = 5
const MAX_APPLICATIONS_PER_VACANCY = 500
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

// Magic byte signatures to verify files aren't just renamed with a trusted extension
const MAGIC_NUMBERS = [
  { bytes: [0x25, 0x50, 0x44, 0x46] },                                    // %PDF
  { bytes: [0x50, 0x4b, 0x03, 0x04] },                                    // PK (ZIP / DOCX)
  { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },          // OLE2 (DOC)
]

function hasValidMagicNumber(buf: ArrayBuffer): boolean {
  const view = new Uint8Array(buf, 0, 8)
  return MAGIC_NUMBERS.some(({ bytes }) => bytes.every((b, i) => view[i] === b))
}

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

  // ── 4. File validation ─────────────────────────────────────────────────────
  if (!ALLOWED_MIME_TYPES.includes(cvFile.type)) {
    return { success: false, error: 'CV must be a PDF or Word document.' }
  }
  if (cvFile.size > MAX_FILE_BYTES) {
    return { success: false, error: 'CV file must be 10 MB or smaller.' }
  }

  // Read file bytes early so we can validate magic numbers and reuse buffer for upload
  const fileBytes = await cvFile.arrayBuffer()
  if (!hasValidMagicNumber(fileBytes)) {
    return { success: false, error: 'CV must be a valid PDF or Word document.' }
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
    .is('deleted_at', null)
    .single()

  if (!vacancy) return { success: false, error: 'This apply link is no longer active.' }

  // Vacancy must be open (draft/on_hold/closed/archived are all blocked)
  type StatusJoin = { code: string } | { code: string }[] | null
  const statusJoin = vacancy.vacancy_statuses as StatusJoin
  const statusCode = Array.isArray(statusJoin) ? statusJoin[0]?.code : statusJoin?.code
  if (vacancy.archived_at || statusCode !== 'open') {
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

  // ── 8. Resolve active candidate general status id ─────────────────────────
  const { data: activeStatus } = await supabase
    .from('candidate_statuses')
    .select('id')
    .eq('code', 'active')
    .single()

  // ── 9. Duplicate detection (email match is sufficient — phone is optional) ─
  let candidateId: string
  let isNewCandidate = false

  const { data: matchedCandidate } = await supabase
    .from('candidates')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', email)
    .eq('general_status_id', activeStatus?.id ?? '')
    .is('deleted_at', null)
    .maybeSingle()

  if (matchedCandidate) {
    candidateId = matchedCandidate.id

    // Already applied to this vacancy — silently succeed (same UX for the applicant)
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('organization_id', orgId)
      .eq('candidate_id', candidateId)
      .eq('vacancy_id', vacancy.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingApp) {
      return { success: true }
    }
  } else {
    // ── 10. Create new candidate ─────────────────────────────────────────────
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
    isNewCandidate = true
  }

  // ── 11. Find "applied" application status ──────────────────────────────────
  const { data: appliedStatus } = await supabase
    .from('application_statuses')
    .select('id')
    .eq('code', 'applied')
    .single()

  // ── 12. Create application ─────────────────────────────────────────────────
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
    // Roll back newly-created candidate to avoid orphaned records
    if (isNewCandidate) {
      await supabase.from('candidates').delete().eq('id', candidateId)
    }
    return { success: false, error: 'Failed to submit application. Please try again.' }
  }

  // ── 13. Upload CV ──────────────────────────────────────────────────────────
  try {
    const rawExt = cvFile.name.split('.').pop()?.toLowerCase() ?? ''
    const ext = ['pdf', 'doc', 'docx'].includes(rawExt) ? rawExt : 'pdf'
    const storagePath = `${orgId}/${candidateId}/${crypto.randomUUID()}.${ext}`

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
        file_path: storagePath,
        document_type: 'cv',
      })
    }
  } catch {
    // CV upload failure is non-fatal — candidate + application already created
  }

  // ── 14. Notify org owners/admins of new application ───────────────────────
  try {
    const { data: orgMembers } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', orgId)
      .in('role', ['owner', 'admin'])

    const recipientIds = (orgMembers || []).map((m) => m.id)
    await createOrgNotifications(orgId, recipientIds, {
      type: 'new_application',
      title: `New application: ${firstName} ${lastName}`,
      body: `Applied for ${vacancy.title}`,
      link: `/vacancies/${vacancy.id}?tab=applications`,
    })
  } catch {
    // Non-fatal
  }

  // ── 15. Send confirmation email ────────────────────────────────────────────
  try {
    const [{ data: org }, { data: templateRow }] = await Promise.all([
      supabase.from('organizations').select('name').eq('id', orgId).single(),
      supabase
        .from('email_templates')
        .select('subject, body')
        .eq('organization_id', orgId)
        .eq('template_type', 'application_received')
        .maybeSingle(),
    ])

    await sendApplicationConfirmationEmail({
      to: email,
      candidateName: `${firstName} ${lastName}`,
      vacancyTitle: vacancy.title,
      organizationName: org?.name || 'the company',
      customSubject: templateRow?.subject,
      customBody: templateRow?.body,
    })
  } catch {
    // Email failure is non-fatal
  }

  return { success: true }
}
