// ============================================================================
// HRHandle — RESET STORAGE (empty the app's buckets) — REUSABLE (any project)
// ============================================================================
//  Companion to scripts/reset-data.sql. Supabase blocks deleting
//  storage.objects from SQL, so files are cleared here via the Storage API.
//
//  This version targets WHICHEVER project the supplied creds point at, and
//  forces you to TYPE that project's ref to proceed — so you can't wipe the
//  wrong environment by muscle memory. It discovers the project's buckets from
//  the Storage API at run time (so a newly-added bucket is emptied too), with a
//  hard-coded fallback list if that call fails.
//
//  RUN (Node 20.6+; reads creds from the env file you pass):
//    Staging:     node --env-file=.env.local            scripts/reset-storage.mjs --confirm quotchdymcnjlnwtjmgu
//    Production:  node --env-file=.env.production.local  scripts/reset-storage.mjs --confirm fnpyfwhvgzoxgyjafbsg
//
//  It prints the target URL + ref first, then refuses unless --confirm <ref>
//  exactly matches the ref embedded in NEXT_PUBLIC_SUPABASE_URL.
// ============================================================================
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

// Fallback list of the app's buckets, used for the pre-confirm warning and if
// the live listBuckets() call fails. The actual run discovers buckets from the
// API (see below) so a newly-added bucket is never missed. Keep this in sync
// with the storage buckets created in migrations (029 + 20260829_support_tickets):
//   avatars · candidate-documents · org-logos · support-attachments
const KNOWN_BUCKETS = ['avatars', 'candidate-documents', 'org-logos', 'support-attachments']

// Known projects — for a friendly label only; the guard works for any ref.
const KNOWN = {
  quotchdymcnjlnwtjmgu: 'STAGING (hrhandle-staging)',
  fnpyfwhvgzoxgyjafbsg: 'PRODUCTION (hrhandle-production)',
}

if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run with:  node --env-file=<env-file> scripts/reset-storage.mjs --confirm <project-ref>',
  )
  process.exit(1)
}

// Extract the project ref from https://<ref>.supabase.co
const ref = (url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || null
const label = ref && KNOWN[ref] ? KNOWN[ref] : 'UNKNOWN project'

console.log(`Target URL: ${url}`)
console.log(`Target ref: ${ref ?? '(could not parse)'}  ->  ${label}`)

if (!ref) {
  console.error('\nCould not parse the project ref from the URL. Aborting.')
  process.exit(1)
}

// --confirm <ref> must match the URL's ref exactly.
const confirmIdx = process.argv.indexOf('--confirm')
const confirmed = confirmIdx !== -1 ? process.argv[confirmIdx + 1] : null
if (confirmed !== ref) {
  console.error(
    `\nRefusing. This will PERMANENTLY EMPTY every storage bucket (e.g. ${KNOWN_BUCKETS.join(', ')})` +
      `\nTo proceed, re-run with:  --confirm ${ref}`,
  )
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

/** Recursively delete every object in a bucket (folders have id === null). */
async function emptyBucket(bucket) {
  let removed = 0
  async function walk(prefix) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
    if (error) {
      if (/not found|does not exist/i.test(error.message)) return
      throw error
    }
    const files = []
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) await walk(path) // sub-folder
      else files.push(path)
    }
    if (files.length) {
      const { error: rmErr } = await supabase.storage.from(bucket).remove(files)
      if (rmErr) throw rmErr
      removed += files.length
    }
  }
  await walk('')
  return removed
}

console.log(`\nConfirmed ${ref}.`)

// Discover the project's buckets from the API so a newly-added bucket is never
// missed (e.g. support-attachments). Fall back to the known list if the call
// fails for any reason.
let buckets = KNOWN_BUCKETS
try {
  const { data, error } = await supabase.storage.listBuckets()
  if (error) throw error
  if (data?.length) buckets = data.map((b) => b.id)
  console.log(`Discovered ${buckets.length} bucket(s): ${buckets.join(', ')}`)
} catch (e) {
  console.warn(`Could not list buckets (${e.message}); falling back to: ${KNOWN_BUCKETS.join(', ')}`)
}

console.log('Emptying buckets…')
let failed = false
for (const bucket of buckets) {
  try {
    const n = await emptyBucket(bucket)
    console.log(`✓ ${bucket}: removed ${n} file(s)`)
  } catch (e) {
    failed = true
    console.error(`✗ ${bucket}: ${e.message}`)
  }
}
console.log(failed ? 'Done with errors.' : 'Done — buckets emptied.')
process.exit(failed ? 1 : 0)
