/**
 * Record an ad-hoc personal-data disclosure in the register
 * (`public.data_disclosures`) — e.g. data handed to an authority on request,
 * or to the payment provider for a dispute. Automatic disclosures (the payer's
 * email at checkout) are recorded by the app itself (lib/data-disclosures.ts).
 * Procedure: docs/9-compliance/breach-response.md → "Requests about personal data".
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/record-disclosure.ts \
 *     --org <org id or ->  --subject-type payer|member|candidate|other  --subject <email/id> \
 *     --data email,name  --recipient "Revenue Service of Georgia"  --purpose "Tax audit request" \
 *     --basis legal_obligation  [--ref <request number>]  [--years 5]
 */
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const get = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const BASES = ['contract', 'legal_obligation', 'consent', 'legitimate_interest', 'vital_interest', 'public_task']
const SUBJECTS = ['payer', 'member', 'candidate', 'other']

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const org = get('org')
  const subjectType = get('subject-type')
  const data = get('data')
  const recipient = get('recipient')
  const purpose = get('purpose')
  const basis = get('basis')
  if (!url || !key || !org || !subjectType || !data || !recipient || !purpose || !basis) {
    console.error('Missing a value; see the usage at the top of scripts/record-disclosure.ts.')
    process.exit(2)
  }
  if (!BASES.includes(basis) || !SUBJECTS.includes(subjectType)) {
    console.error(`--basis must be one of ${BASES.join(', ')}; --subject-type one of ${SUBJECTS.join(', ')}.`)
    process.exit(2)
  }
  const years = Number(get('years') ?? 5)
  const retain = new Date()
  retain.setUTCFullYear(retain.getUTCFullYear() + years)

  console.error(`Database: ${new URL(url).host}`)
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data: row, error } = await db
    .from('data_disclosures')
    .insert({
      organization_id: org === '-' ? null : org,
      subject_type: subjectType,
      subject_ref: get('subject') ?? null,
      data_categories: data.split(',').map((s) => s.trim()).filter(Boolean),
      recipient,
      purpose,
      legal_basis: basis,
      related_ref: get('ref') ?? null,
      retain_until: retain.toISOString(),
    })
    .select('id, disclosed_at')
    .single()
  if (error) {
    console.error('Insert failed:', error.message)
    process.exit(1)
  }
  console.log(`Recorded ${row.id} at ${row.disclosed_at}.`)
}

void main()
