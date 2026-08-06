import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from '@/components/landing/language-switcher'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/locales'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Users,
  Briefcase,
  Calendar,
  BarChart3,
  ArrowRight,
  Zap,
  Sparkles,
  Share2,
  GitBranch,
  Star,
} from 'lucide-react'
import { PRICING_PLANS } from '@/lib/types/subscription'
import { isCampaignActive, CAMPAIGN } from '@/lib/campaign'
import { PricingSection } from '@/components/landing/pricing-section'
import { PaymentMethods } from '@/components/subscription/payment-methods'
import { SUPPORT_PHONE, BUSINESS_ADDRESS } from '@/lib/legal/contact'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hrhandle.com'

export const metadata: Metadata = {
  alternates: {
    canonical: SITE_URL,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'HRHandle',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description:
    'HRHandle is a modern applicant tracking system that helps teams manage vacancies, evaluate candidates with structured scoring, schedule interviews, and share roles on LinkedIn.',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free Trial',
      price: '0',
      priceCurrency: 'USD',
      description: '7-day free trial',
    },
    {
      '@type': 'Offer',
      name: 'Individual Plan',
      price: '20',
      priceCurrency: 'USD',
      description: 'Individual plan billed monthly',
    },
    {
      '@type': 'Offer',
      name: 'Organization Plan',
      price: '40',
      priceCurrency: 'USD',
      description: 'Organization plan billed monthly',
    },
  ],
  provider: {
    '@type': 'Organization',
    name: 'HRHandle',
    url: SITE_URL,
  },
}

export default async function LandingPage() {
  // CSP nonce (S-014): middleware sets `x-nonce` per request; the inline
  // JSON-LD script needs it so it isn't blocked once we tighten the CSP.
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const t = await getTranslations()
  const rawLocale = await getLocale()
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Briefcase className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <span className="text-xl font-bold text-foreground">HRHandle</span>
            </div>

            <div className="hidden items-center gap-8 md:flex">
              <Link
                href="#features"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('landing.nav.features')}
              </Link>
              <Link
                href="#pricing"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('landing.nav.pricing')}
              </Link>
              <Link
                href="/guide"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('landing.nav.guides')}
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher current={locale} />
              <Button variant="ghost" asChild>
                <Link href="/auth/login">{t('landing.nav.signIn')}</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/sign-up">{t('landing.nav.getStarted')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <section className="px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Zap className="h-4 w-4" />
              {t('landing.hero.badge')}
            </div>

            <h1 className="text-balance text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              {t('landing.hero.headline')}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
              {t('landing.hero.subhead')}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/auth/sign-up">
                  {t('landing.hero.startTrial')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>

              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="#features">{t('landing.hero.learnMore')}</Link>
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">{t('landing.hero.trialNote')}</p>
          </div>

          {/* Product peek — mini 4-column kanban preview */}
          <div className="mx-auto mt-16 max-w-3xl overflow-hidden rounded-t-2xl border border-border bg-card shadow-sm">
            <div className="flex h-8 items-center gap-2 border-b border-border bg-muted/40 px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300/80" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" aria-hidden />
            </div>
            <div className="grid grid-cols-2 gap-2.5 bg-muted/30 p-4 sm:grid-cols-4">
              <PeekColumn label="APPLIED 4" labelClass="text-primary" tint="border-l-primary">
                <PeekCard name="John Doe" />
                <PeekCard name="Jane Smith" />
              </PeekColumn>
              <PeekColumn label="SCREENING 2" labelClass="text-amber-700" tint="border-l-amber-400">
                <PeekCard name="Alex Brown" badge="Fit 7.9" />
              </PeekColumn>
              <PeekColumn label="INTERVIEW 1" labelClass="text-purple-700" tint="border-l-purple-400">
                <PeekCard name="Maria Lee" />
              </PeekColumn>
              <PeekColumn label="OFFER 1" labelClass="text-sky-700" tint="border-l-sky-400">
                <PeekCard name="Sam Carter" />
              </PeekColumn>
            </div>
          </div>
        </div>
      </section>

      {/* Honest proof strip — replaces vanity stats. Kept as <dl>
          to preserve AC-007 semantic grouping. */}
      <section className="border-y border-border bg-card px-4 py-10 sm:px-6 lg:px-8">
        <dl
          aria-label={t('landing.proof.aria')}
          className="mx-auto flex max-w-5xl flex-wrap items-start justify-center gap-12 text-center sm:gap-16"
        >
          <div>
            <dt className="text-2xl font-bold text-foreground sm:text-3xl">{t('landing.proof.onePipeline')}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{t('landing.proof.onePipelineDesc')}</dd>
          </div>
          <div>
            <dt className="text-2xl font-bold text-foreground sm:text-3xl">{t('landing.proof.score')}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{t('landing.proof.scoreDesc')}</dd>
          </div>
          <div>
            <dt className="text-2xl font-bold text-foreground sm:text-3xl">
              $20<span className="text-base font-medium text-muted-foreground">/mo</span>
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">{t('landing.proof.priceDesc')}</dd>
          </div>
        </dl>
      </section>

      <section id="features" className="bg-card px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              {t('landing.features.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {t('landing.features.subtitle')}
            </p>
          </div>

          {/* Hero feature — structured evaluation as the differentiator */}
          <div className="mx-auto mb-6 max-w-5xl overflow-hidden rounded-2xl bg-foreground p-8 sm:p-10">
            <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-center">
              <div className="flex-1">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-primary-foreground/90">
                  <Star className="h-3 w-3 fill-current" aria-hidden />
                  {t('landing.features.difference')}
                </div>
                <h3 className="text-2xl font-bold text-background sm:text-3xl">
                  {t('landing.features.heroTitle')}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-background/75">
                  {t('landing.features.heroBody')}
                </p>
              </div>
              <div className="w-full max-w-sm rounded-xl bg-background p-5 lg:w-80 lg:shrink-0">
                <p className="mb-3 text-xs font-bold text-foreground">Scorecard · avg 7.9</p>
                <div className="space-y-2.5">
                  <ScorecardRow label="Communication" pct={90} />
                  <ScorecardRow label="Req. gathering" pct={80} />
                  <ScorecardRow label="Modeling" pct={60} accent="amber" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: GitBranch, title: t('landing.feature.pipeline.title'), description: t('landing.feature.pipeline.desc') },
              { icon: Users, title: t('landing.feature.profiles.title'), description: t('landing.feature.profiles.desc') },
              { icon: Calendar, title: t('landing.feature.scheduling.title'), description: t('landing.feature.scheduling.desc') },
              { icon: Sparkles, title: t('landing.feature.ai.title'), description: t('landing.feature.ai.desc') },
              { icon: Share2, title: t('landing.feature.share.title'), description: t('landing.feature.share.desc') },
              { icon: BarChart3, title: t('landing.feature.reports.title'), description: t('landing.feature.reports.desc') },
            ].map((feature) => (
              <Card key={feature.title} className="border-border bg-background">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              {t('landing.pricing.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {t('landing.pricing.subtitle')}
            </p>
          </div>
          <PricingSection
            plans={PRICING_PLANS}
            campaign={CAMPAIGN}
            campaignActive={isCampaignActive()}
          />
        </div>
      </section>

      <section className="bg-primary px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-primary-foreground sm:text-4xl">
            {t('landing.cta.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            {t('landing.cta.subtitle')}
          </p>
          <Button size="lg" variant="secondary" className="mt-8" asChild>
            <Link href="/auth/sign-up">
              {t('landing.cta.button')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border bg-card px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Briefcase className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <span className="text-xl font-bold text-foreground">HRHandle</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <Link href="/guide" className="transition-colors hover:text-foreground">
                {t('landing.nav.guides')}
              </Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">
                {t('landing.footer.terms')}
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                {t('landing.footer.privacy')}
              </Link>
              <Link href="/refund" className="transition-colors hover:text-foreground">
                {t('landing.footer.refund')}
              </Link>
            </div>

            <p className="text-sm text-muted-foreground">
              {t('landing.footer.rights', { year: new Date().getFullYear() })}
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-4 border-t border-border pt-8 text-center text-xs text-muted-foreground">
            <PaymentMethods />
            <p>
              Aleksandre Merabishvili, Individual Entrepreneur · ID 01019062001 · {BUSINESS_ADDRESS}
              <br />
              <a href="mailto:hrhandle26@gmail.com" className="underline">hrhandle26@gmail.com</a> ·{' '}
              {SUPPORT_PHONE}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function PeekColumn({
  label,
  labelClass,
  tint,
  children,
}: {
  label: string
  labelClass: string
  tint: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className={`text-[10px] font-bold tracking-wide ${labelClass}`}>{label}</p>
      <div className="space-y-1.5">
        {Array.isArray(children)
          ? children.map((c, i) => (
              <div key={i} className={`rounded-md border border-border border-l-[3px] ${tint} bg-background p-2`}>
                {c}
              </div>
            ))
          : (
              <div className={`rounded-md border border-border border-l-[3px] ${tint} bg-background p-2`}>
                {children}
              </div>
            )}
      </div>
    </div>
  )
}

function PeekCard({ name, badge }: { name: string; badge?: string }) {
  return (
    <>
      <p className="text-[11px] font-semibold text-foreground">{name}</p>
      {badge && (
        <span className="mt-1 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
          {badge}
        </span>
      )}
    </>
  )
}

function ScorecardRow({ label, pct, accent }: { label: string; pct: number; accent?: 'amber' }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${accent === 'amber' ? 'bg-amber-400' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
