import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { GUIDES, getGuidesByCategory } from '@/lib/guides/registry'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'guides')

describe('guide registry', () => {
  it('has no duplicate slugs', () => {
    const slugs = GUIDES.map((g) => g.slug)
    const unique = new Set(slugs)
    expect(unique.size).toBe(slugs.length)
  })

  it('has no duplicate order values', () => {
    const orders = GUIDES.map((g) => g.order)
    const unique = new Set(orders)
    expect(unique.size).toBe(orders.length)
  })

  it('every guide has a non-empty title and summary', () => {
    for (const g of GUIDES) {
      expect(g.title.trim().length, `title for ${g.slug}`).toBeGreaterThan(0)
      expect(g.summary.trim().length, `summary for ${g.slug}`).toBeGreaterThan(0)
    }
  })

  it('groups guides into known categories', () => {
    const grouped = getGuidesByCategory()
    const totalGrouped = Object.values(grouped).reduce((sum, list) => sum + list.length, 0)
    expect(totalGrouped).toBe(GUIDES.length)
  })
})

describe('guide MDX files', () => {
  it('every MDX file in content/guides has a matching registry entry', () => {
    const files = fs.existsSync(CONTENT_DIR) ? fs.readdirSync(CONTENT_DIR) : []
    const slugs = new Set(GUIDES.map((g) => g.slug))
    for (const file of files) {
      if (!file.endsWith('.mdx')) continue
      const slug = file.replace(/\.mdx$/, '')
      expect(slugs.has(slug), `MDX file ${file} has no registry entry`).toBe(true)
    }
  })

  it('every MDX file parses and has frontmatter with title and summary', () => {
    const files = fs.existsSync(CONTENT_DIR) ? fs.readdirSync(CONTENT_DIR) : []
    for (const file of files) {
      if (!file.endsWith('.mdx')) continue
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')
      const { data } = matter(raw)
      expect(typeof data.title, `title in ${file}`).toBe('string')
      expect(typeof data.summary, `summary in ${file}`).toBe('string')
    }
  })
})
