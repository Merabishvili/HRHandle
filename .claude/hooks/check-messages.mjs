#!/usr/bin/env node
// PostToolUse on Edit|Write: after a change to messages/source.json or
// messages/emails.source.json, check that every key has en/ka/ru text and the
// generated per-locale files are fresh. Exit 2 sends the problem back to Claude.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}
const file = String(input.tool_input?.file_path ?? input.tool_response?.filePath ?? '')
const isSource = file.endsWith('messages/source.json')
const isEmails = file.endsWith('messages/emails.source.json')
if (!isSource && !isEmails) process.exit(0)

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const problems = []

let data
try {
  data = JSON.parse(readFileSync(file, 'utf8'))
} catch (err) {
  console.error(`${file} is not valid JSON: ${err.message}`)
  process.exit(2)
}
for (const [key, entry] of Object.entries(data)) {
  if (key.startsWith('_') || typeof entry !== 'object' || entry === null) continue
  const gaps = ['en', 'ka', 'ru'].filter((l) => entry[l] == null || entry[l] === '')
  if (gaps.length) problems.push(`  ${key}: missing ${gaps.join(', ')}`)
}

if (isSource) {
  const res = spawnSync('node', [join(root, 'scripts/build-messages.mjs'), '--check'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (res.status !== 0) problems.push((res.stderr || res.stdout).trim())
}

if (problems.length) {
  console.error(
    `Translation check failed for ${file.replace(root + '/', '')}. Every key needs English, Georgian and Russian text` +
      (isSource ? ', and `npm run messages:build` must be run after editing.' : '.') +
      `\n${problems.slice(0, 30).join('\n')}` +
      (problems.length > 30 ? `\n  …and ${problems.length - 30} more` : ''),
  )
  process.exit(2)
}
process.exit(0)
