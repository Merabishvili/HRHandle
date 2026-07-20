import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { getGuideBySlug, type GuideMeta } from './registry'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'guides')

export interface LoadedGuide {
  meta: GuideMeta
  frontmatter: {
    title: string
    summary: string
    updated?: string
  }
  content: string
}

export async function loadGuide(slug: string): Promise<LoadedGuide | null> {
  const meta = getGuideBySlug(slug)
  if (!meta) return null

  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch (err) {
    console.warn(`[guides/loader] failed to read guide "${slug}":`, err instanceof Error ? err.message : err)
    return null
  }

  const { data, content } = matter(raw)
  return {
    meta,
    frontmatter: {
      title: typeof data.title === 'string' ? data.title : meta.title,
      summary: typeof data.summary === 'string' ? data.summary : meta.summary,
      ...(typeof data.updated === 'string' ? { updated: data.updated } : {}),
    },
    content,
  }
}

export async function listExistingGuideSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(CONTENT_DIR)
    return entries
      .filter((name) => name.endsWith('.mdx'))
      .map((name) => name.replace(/\.mdx$/, ''))
  } catch (err) {
    console.warn(`[guides/loader] failed to read content dir "${CONTENT_DIR}":`, err instanceof Error ? err.message : err)
    return []
  }
}
