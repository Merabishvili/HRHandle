import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import {
  CATEGORY_KEY,
  GUIDES,
  GUIDE_CATEGORIES,
  GUIDE_FAQ_KEYS,
  LEGACY_GUIDE_SLUGS,
  getGuidesByCategory,
} from '@/lib/guides/registry'
import { LOCALES } from '@/lib/i18n/locales'
import source from '@/messages/source.json'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'guides')
const SHOTS_DIR = path.join(process.cwd(), 'public', 'guide', 'screenshots')
const SIZES = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'screenshots.json'), 'utf8')) as Record<
  string,
  Record<string, [number, number]>
>
const messages = source as Record<string, Record<string, string>>

const slugsIn = (locale: string): string[] => {
  const dir = path.join(CONTENT_DIR, locale)
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''))
    : []
}
const read = (locale: string, slug: string) => fs.readFileSync(path.join(CONTENT_DIR, locale, `${slug}.mdx`), 'utf8')
const headings = (body: string) => body.split('\n').filter((l) => /^#{2,3} /.test(l)).map((l) => l.match(/^#+/)![0])
const shotNames = (body: string) => Array.from(body.matchAll(/<Screenshot\b[^>]*\bname="([^"]+)"/g)).map((m) => m[1]!)
const published = slugsIn('en')

describe('guide registry', () => {
  it('has unique slugs, ids and order values', () => {
    for (const key of ['slug', 'id', 'order'] as const) {
      const values = GUIDES.map((g) => g[key])
      expect(new Set(values).size, key).toBe(values.length)
    }
  })

  it('puts every guide in a known category, and no category is empty', () => {
    const grouped = getGuidesByCategory()
    expect(Object.keys(grouped)).toEqual([...GUIDE_CATEGORIES])
    for (const category of GUIDE_CATEGORIES) expect(grouped[category].length, category).toBeGreaterThan(0)
    expect(Object.values(grouped).flat()).toHaveLength(GUIDES.length)
  })

  it('redirects renamed topics to a current topic', () => {
    const slugs = new Set(GUIDES.map((g) => g.slug))
    for (const [old, target] of Object.entries(LEGACY_GUIDE_SLUGS)) {
      expect(slugs.has(old), `${old} is still a current slug`).toBe(false)
      expect(slugs.has(target), `${old} → ${target}`).toBe(true)
    }
  })
})

describe('guide messages', () => {
  const keys = [
    ...GUIDES.flatMap((g) => [`guide.topic.${g.id}.title`, `guide.topic.${g.id}.summary`]),
    ...GUIDE_CATEGORIES.map((c) => `guide.category.${CATEGORY_KEY[c]}`),
    ...GUIDE_FAQ_KEYS.flatMap((k) => [`guide.faq.${k}.q`, `guide.faq.${k}.a`]),
  ]

  it('has every title, summary, category and FAQ entry in every language', () => {
    for (const key of keys) {
      for (const locale of LOCALES) {
        expect(messages[key]?.[locale]?.trim(), `${key} [${locale}]`).toBeTruthy()
      }
    }
  })
})

describe('guide content', () => {
  it('has a registry entry for every guide file', () => {
    const slugs = new Set(GUIDES.map((g) => g.slug))
    for (const locale of LOCALES) {
      for (const slug of slugsIn(locale)) expect(slugs.has(slug), `${locale}/${slug}.mdx`).toBe(true)
    }
  })

  it('publishes every guide in all three languages', () => {
    expect(published.length).toBeGreaterThan(0)
    for (const locale of LOCALES) expect(slugsIn(locale).sort(), locale).toEqual([...published].sort())
  })

  it('keeps the same sections and screenshots in every translation', () => {
    for (const slug of published) {
      const en = matter(read('en', slug)).content
      for (const locale of LOCALES) {
        const { data, content } = matter(read(locale, slug))
        expect(data.updated, `${locale}/${slug}: updated`).toBeTruthy()
        expect(headings(content), `${locale}/${slug}: headings`).toEqual(headings(en))
        expect(shotNames(content), `${locale}/${slug}: screenshots`).toEqual(shotNames(en))
      }
    }
  })

  it('has every referenced screenshot on disk, with its size recorded', () => {
    for (const slug of published) {
      for (const locale of LOCALES) {
        const body = read(locale, slug)
        expect(body, `${locale}/${slug}: use name=, not src=`).not.toMatch(/<Screenshot\b[^>]*\bsrc=/)
        for (const name of shotNames(body)) {
          expect(fs.existsSync(path.join(SHOTS_DIR, locale, `${name}.webp`)), `${locale}/${name}.webp`).toBe(true)
          expect(SIZES[locale]?.[name], `size of ${locale}/${name}`).toHaveLength(2)
        }
      }
    }
  })

  it('links only to topics that exist', () => {
    const slugs = new Set(GUIDES.map((g) => g.slug))
    for (const slug of published) {
      for (const locale of LOCALES) {
        for (const [, target] of read(locale, slug).matchAll(/\]\(\/guide\/([a-z0-9-]+)/g)) {
          expect(slugs.has(target!), `${locale}/${slug} → ${target}`).toBe(true)
        }
      }
    }
  })
})
