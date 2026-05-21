import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { GUIDES } from '@/lib/guides/registry'
import { listExistingGuideSlugs, loadGuide } from '@/lib/guides/loader'
import { GuideShell } from '@/components/guide/guide-shell'
import { GuideSidebar } from '@/components/guide/guide-sidebar'
import { guideMdxComponents } from '@/components/guide/mdx-components'

export const dynamicParams = false

export async function generateStaticParams() {
  const existing = new Set(await listExistingGuideSlugs())
  return GUIDES.filter((g) => existing.has(g.slug)).map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const guide = await loadGuide(slug)
  if (!guide) return {}
  return {
    title: `${guide.frontmatter.title} — HRHandle Guides`,
    description: guide.frontmatter.summary,
    alternates: { canonical: `https://hrhandle.com/guide/${slug}` },
  }
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const guide = await loadGuide(slug)
  if (!guide) notFound()

  const existingSlugs = new Set(await listExistingGuideSlugs())

  return (
    <GuideShell>
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <GuideSidebar currentSlug={slug} existingSlugs={existingSlugs} />
        </aside>
        <article className="min-w-0">
          <header className="mb-8 border-b border-border pb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Guide
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              {guide.frontmatter.title}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">{guide.frontmatter.summary}</p>
          </header>
          <div className="prose-styles">
            <MDXRemote
              source={guide.content}
              components={guideMdxComponents}
              options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
            />
          </div>
        </article>
      </div>
    </GuideShell>
  )
}
