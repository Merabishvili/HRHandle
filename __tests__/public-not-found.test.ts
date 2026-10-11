import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Every public "link no longer valid" page (status, offer, shared assessment,
// apply, jobs) renders <LinkNotFound> with message keys — check they exist in
// all three languages, so a typo can't show a raw key to a candidate.
const ROOT = path.resolve(__dirname, '..')
const messages = JSON.parse(fs.readFileSync(path.join(ROOT, 'messages/source.json'), 'utf8')) as Record<
  string,
  Record<'en' | 'ka' | 'ru', string>
>
const PAGES = [
  'app/status/[token]/not-found.tsx',
  'app/offer/[token]/not-found.tsx',
  'app/scorecard/[token]/not-found.tsx',
  'app/apply/[token]/not-found.tsx',
  'app/jobs/[slug]/not-found.tsx',
]

describe('public link not-found pages', () => {
  it.each(PAGES)('%s uses translated keys', (page) => {
    const source = fs.readFileSync(path.join(ROOT, page), 'utf8')
    expect(source).toContain('<LinkNotFound')
    const keys = [...source.matchAll(/(?:titleKey|bodyKey)="([^"]+)"/g)].map((m) => m[1]!)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of [...keys, 'publicLink.notFoundTitle', 'publicLink.goHome']) {
      for (const locale of ['en', 'ka', 'ru'] as const) {
        expect(messages[key]?.[locale], `${key} (${locale})`).toBeTruthy()
      }
    }
  })
})
