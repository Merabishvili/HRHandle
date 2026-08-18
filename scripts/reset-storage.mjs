// ============================================================================
// reset-storage.mjs — empties the HRHandle storage buckets (test-data reset)
// ============================================================================
// Companion to scripts/reset-test-data.sql. That SQL can't touch storage
// (Supabase blocks direct DELETE on storage.objects), so this empties the
// candidate-documents and org-logos buckets via the Storage API using the
// service-role key.
//
//   node scripts/reset-storage.mjs            # DRY RUN — lists what it'd delete
//   node scripts/reset-storage.mjs --apply    # actually empties the buckets
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the
// environment, falling back to .env.local. Guards on the staging project ref.
// ============================================================================
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const STAGING_HOST = 'quotchdymcnjlnwtjmgu.supabase.co' // never production
const BUCKETS = ['candidate-documents', 'org-logos']
const APPLY = process.argv.includes('--apply')

function loadEnv() {
  const env = { ...process.env }
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const i = t.indexOf('=')
      const k = t.slice(0, i).trim()
      if (env[k] === undefined) env[k] = t.slice(i + 1).trim()
    }
  } catch {
    /* no .env.local — rely on process.env */
  }
  return env
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (new URL(url).host !== STAGING_HOST) {
  console.error(`Refusing to run: ${new URL(url).host} is not the staging project (${STAGING_HOST}).`)
  process.exit(1)
}

const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

// Recursively list every object path under a bucket (folders come back as rows
// with no id; files have an id).
async function listAll(bucket, prefix = '') {
  const out = []
  let offset = 0
  for (;;) {
    const res = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: ${res.status} ${await res.text()}`)
    const rows = await res.json()
    if (rows.length === 0) break
    for (const r of rows) {
      const path = prefix ? `${prefix}/${r.name}` : r.name
      if (r.id === null || r.id === undefined) {
        out.push(...(await listAll(bucket, path))) // folder → recurse
      } else {
        out.push(path)
      }
    }
    if (rows.length < 1000) break
    offset += rows.length
  }
  return out
}

async function removeAll(bucket, paths) {
  for (let i = 0; i < paths.length; i += 1000) {
    const chunk = paths.slice(i, i + 1000)
    const res = await fetch(`${url}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: h,
      body: JSON.stringify({ prefixes: chunk }),
    })
    if (!res.ok) throw new Error(`delete ${bucket}: ${res.status} ${await res.text()}`)
  }
}

let total = 0
for (const bucket of BUCKETS) {
  const paths = await listAll(bucket)
  total += paths.length
  console.log(`${bucket}: ${paths.length} object(s)`)
  for (const p of paths) console.log(`  ${p}`)
  if (APPLY && paths.length) {
    await removeAll(bucket, paths)
    console.log(`  → deleted ${paths.length}`)
  }
}
console.log('-'.repeat(46))
console.log(APPLY ? `Emptied buckets — ${total} object(s) removed.` : `DRY RUN — ${total} object(s) would be removed. Re-run with --apply.`)
