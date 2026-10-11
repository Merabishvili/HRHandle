import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { getGuideBySlug, type GuideMeta } from './registry'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'guides')

export interface LoadedGuide {
  meta: GuideMeta
  /** The language the body is actually in (English when a translation is missing). */
  locale: Locale
  updated?: string
  content: string
}

async function readGuideFile(slug: string, locale: Locale): Promise<string | null> {
  try {
    return await fs.readFile(path.join(CONTENT_DIR, locale, `${slug}.mdx`), 'utf8')
  } catch {
    return null
  }
}

/** A guide's body in `locale`, falling back to English if that file is missing. */
export async function loadGuide(slug: string, locale: Locale): Promise<LoadedGuide | null> {
  const meta = getGuideBySlug(slug)
  if (!meta) return null

  let bodyLocale = locale
  let raw = await readGuideFile(slug, locale)
  if (raw === null && locale !== DEFAULT_LOCALE) {
    bodyLocale = DEFAULT_LOCALE
    raw = await readGuideFile(slug, DEFAULT_LOCALE)
  }
  if (raw === null) return null

  const { data, content } = matter(raw)
  // gray-matter parses an unquoted YAML date into a Date.
  const updated =
    data.updated instanceof Date
      ? data.updated.toISOString().slice(0, 10)
      : typeof data.updated === 'string'
        ? data.updated
        : undefined
  return { meta, locale: bodyLocale, ...(updated ? { updated } : {}), content }
}

/** Slugs of published guides (English is the source, so it decides). */
export async function listExistingGuideSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(CONTENT_DIR, DEFAULT_LOCALE))
    return entries.filter((name) => name.endsWith('.mdx')).map((name) => name.replace(/\.mdx$/, ''))
  } catch (err) {
    console.warn('[guides/loader] failed to read the guide content folder:', err instanceof Error ? err.message : err)
    return []
  }
}
