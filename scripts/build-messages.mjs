#!/usr/bin/env node
/**
 * Build per-locale message catalogs from the single reviewable source file.
 *
 * INPUT   messages/source.json   — one entry per key, all locales side-by-side:
 *           { "nav.pipeline": { "en": "Pipeline", "ru": "Пайплайн", "ka": "პაიპლაინი" } }
 *         Flat, dotted keys so a reviewer sees en / ru / ka together (see
 *         docs/redesign/i18n-plan.md §2, Q1).
 *
 * OUTPUT  messages/en.json, messages/ka.json, messages/ru.json — nested objects
 *         (dotted keys expanded) in the shape next-intl consumes. A locale
 *         missing a value falls back to English, and the gap is reported so it
 *         stays visible.
 *
 * Usage:  npm run messages:build          (write the per-locale files)
 *         npm run messages:build -- --check  (CI: fail if outputs are stale or
 *                                             any non-en value is missing)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const LOCALES = ['en', 'ka', 'ru']
const SOURCE_LOCALE = 'en'

const here = dirname(fileURLToPath(import.meta.url))
const messagesDir = join(here, '..', 'messages')
const sourcePath = join(messagesDir, 'source.json')

const checkOnly = process.argv.includes('--check')

/** Expand { "a.b.c": v } → { a: { b: { c: v } } }. */
function nest(flat) {
  const out = {}
  for (const [dotted, value] of Object.entries(flat)) {
    const parts = dotted.split('.')
    let node = out
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] ??= {}
      node = node[parts[i]]
    }
    node[parts[parts.length - 1]] = value
  }
  return out
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
const keys = Object.keys(source)

const missing = { ka: [], ru: [] }
const emptySource = []

const flatByLocale = Object.fromEntries(LOCALES.map((l) => [l, {}]))
for (const key of keys) {
  const entry = source[key] ?? {}
  const en = entry[SOURCE_LOCALE]
  if (en == null || en === '') emptySource.push(key)
  for (const locale of LOCALES) {
    const value = entry[locale]
    if (locale !== SOURCE_LOCALE && (value == null || value === '')) missing[locale].push(key)
    flatByLocale[locale][key] = value != null && value !== '' ? value : (en ?? key)
  }
}

// Report.
console.log(`messages: ${keys.length} keys × ${LOCALES.length} locales`)
if (emptySource.length) console.log(`  ⚠ ${emptySource.length} key(s) missing an English source value`)
for (const locale of ['ka', 'ru']) {
  const n = missing[locale].length
  console.log(`  ${n === 0 ? '✓' : '·'} ${locale}: ${keys.length - n}/${keys.length} translated${n ? ` (${n} fall back to en)` : ''}`)
}

const outputs = LOCALES.map((locale) => ({
  path: join(messagesDir, `${locale}.json`),
  content: JSON.stringify(nest(flatByLocale[locale]), null, 2) + '\n',
}))

if (checkOnly) {
  let stale = false
  for (const { path, content } of outputs) {
    let current = ''
    try {
      current = readFileSync(path, 'utf8')
    } catch {
      /* missing → stale */
    }
    if (current !== content) {
      console.error(`  ✗ stale: ${path.replace(messagesDir, 'messages')} — run \`npm run messages:build\``)
      stale = true
    }
  }
  if (emptySource.length) {
    console.error(`  ✗ ${emptySource.length} key(s) have no English source`)
    stale = true
  }
  process.exit(stale ? 1 : 0)
}

for (const { path, content } of outputs) writeFileSync(path, content)
console.log(`  wrote ${outputs.map((o) => o.path.replace(messagesDir + '/', '')).join(', ')}`)
