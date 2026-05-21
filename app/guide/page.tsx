import type { Metadata } from 'next'
import { CATEGORY_LABELS, GUIDES, type GuideCategory, type GuideMeta } from '@/lib/guides/registry'
import { listExistingGuideSlugs } from '@/lib/guides/loader'
import { GuideShell } from '@/components/guide/guide-shell'
import { GuideCard } from '@/components/guide/guide-card'

export const metadata: Metadata = {
  title: 'HRHandle Guides',
  description:
    'Step-by-step walkthroughs of HRHandle features — post vacancies, manage candidates, schedule interviews, and more.',
  alternates: { canonical: 'https://hrhandle.com/guide' },
}

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'Is there a free trial?',
    a: 'Yes. Every new organization gets a 7-day free trial with full access. No credit card is required to start.',
  },
  {
    q: 'Which CV formats are supported?',
    a: 'PDF and Word (DOCX) files up to 10 MB. Uploads are scanned for valid file content before parsing.',
  },
  {
    q: 'Can I export candidate or application data?',
    a: 'Yes. Both candidates and per-vacancy applications can be exported as CSV from their list pages.',
  },
  {
    q: 'Which calendar and video tools are supported?',
    a: 'Google Calendar with Google Meet, Zoom, and Microsoft 365 with Teams. Connect them in Settings → Integrations.',
  },
  {
    q: 'What languages does the interface support?',
    a: 'English. Russian is planned for a future release.',
  },
]

export default async function GuideIndexPage() {
  const existingSlugs = new Set(await listExistingGuideSlugs())

  const grouped = new Map<GuideCategory, GuideMeta[]>()
  for (const guide of [...GUIDES].sort((a, b) => a.order - b.order)) {
    if (!grouped.has(guide.category)) grouped.set(guide.category, [])
    grouped.get(guide.category)!.push(guide)
  }

  return (
    <GuideShell>
      <div className="mb-10 space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Guides</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Practical, step-by-step walkthroughs of every HRHandle feature. Use them to onboard your team or to evaluate the product before signing up.
        </p>
      </div>

      <div className="space-y-10">
        {Array.from(grouped.entries()).map(([category, guides]) => (
          <section key={category}>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((guide) => (
                <GuideCard
                  key={guide.slug}
                  guide={guide}
                  exists={existingSlugs.has(guide.slug)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-16 border-t border-border pt-10">
        <h2 className="mb-6 text-2xl font-semibold text-foreground">Frequently asked questions</h2>
        <div className="space-y-6">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q}>
              <h3 className="mb-1 font-medium text-foreground">{item.q}</h3>
              <p className="text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </GuideShell>
  )
}
