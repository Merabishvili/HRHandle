#!/usr/bin/env node
// Stop hook: if this working tree changes app code (app/, lib/, components/,
// middleware.ts, supabase/migrations/) but no docs/ file, remind Claude once
// that every change touches code, docs, tests and a ripple-check.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  /* no input */
}
if (input.stop_hook_active) process.exit(0)

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout ?? ''

// Uncommitted changes plus commits on this branch not yet on origin.
const upstream = spawnSync('git', ['rev-parse', '--abbrev-ref', '@{u}'], { cwd: root, encoding: 'utf8' })
const files = new Set(
  [
    git('diff', '--name-only', 'HEAD'),
    git('ls-files', '--others', '--exclude-standard'),
    upstream.status === 0 ? git('diff', '--name-only', '@{u}...HEAD') : '',
  ]
    .join('\n')
    .split('\n')
    .filter(Boolean),
)

const code = [...files].filter(
  (f) =>
    /^(app|lib|components|supabase\/migrations)\//.test(f) || f === 'middleware.ts',
).filter((f) => !/(__tests__|\.test\.)/.test(f))
const docs = [...files].filter((f) => f.startsWith('docs/') || f === 'CLAUDE.md')

if (code.length && !docs.length) {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        `Code changed (${code.slice(0, 5).join(', ')}${code.length > 5 ? ', …' : ''}) but no docs/ file did. ` +
        'Update the matching docs (or say why none applies), check tests, and ripple-check callers before finishing.',
    }),
  )
}
process.exit(0)
