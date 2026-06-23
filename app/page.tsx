import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
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
                Features
              </Link>
              <Link
                href="#pricing"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                href="/guide"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Guides
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/sign-up">Get Started</Link>
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
              The ATS built for small teams that hire carefully
            </div>

            <h1 className="text-balance text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              Hire with structure, not spreadsheets
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
              Manage every role and candidate in one pipeline, score interviews consistently, and make defensible hiring decisions — without enterprise bloat.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/auth/sign-up">
                  Start free trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>

              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="#features">Learn more</Link>
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">7-day free trial · no credit card to start</p>
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
          aria-label="Why HRHandle"
          className="mx-auto flex max-w-5xl flex-wrap items-start justify-center gap-12 text-center sm:gap-16"
        >
          <div>
            <dt className="text-2xl font-bold text-foreground sm:text-3xl">One pipeline</dt>
            <dd className="mt-1 text-sm text-muted-foreground">every role &amp; candidate in one place</dd>
          </div>
          <div>
            <dt className="text-2xl font-bold text-foreground sm:text-3xl">Score, don&apos;t guess</dt>
            <dd className="mt-1 text-sm text-muted-foreground">consistent scorecards per role</dd>
          </div>
          <div>
            <dt className="text-2xl font-bold text-foreground sm:text-3xl">
              $20<span className="text-base font-medium text-muted-foreground">/mo</span>
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">individual plan · cancel anytime</dd>
          </div>
        </dl>
      </section>

      <section id="features" className="bg-card px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              The recruiter&apos;s daily loop, designed to be fast.
            </p>
          </div>

          {/* Hero feature — structured evaluation as the differentiator */}
          <div className="mx-auto mb-6 max-w-5xl overflow-hidden rounded-2xl bg-foreground p-8 sm:p-10">
            <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-center">
              <div className="flex-1">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-primary-foreground/90">
                  <Star className="h-3 w-3 fill-current" aria-hidden />
                  The difference
                </div>
                <h3 className="text-2xl font-bold text-background sm:text-3xl">
                  Structured evaluation, built in
                </h3>
                <p className="mt-3 text-base leading-relaxed text-background/75">
                  Define what matters for each role once. Every interviewer scores against the same criteria, independently — so your decision rests on evidence and consensus, not the loudest voice in the room.
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
              {
                icon: GitBranch,
                title: 'One pipeline, all roles',
                description:
                  'A board across every vacancy with a fast review mode for new applicants. Stop digging through per-job tabs.',
              },
              {
                icon: Users,
                title: 'Rich candidate profiles',
                description:
                  'CV auto-parsed into experience, education and contact. Notes, documents and full history in one view.',
              },
              {
                icon: Calendar,
                title: 'Interview scheduling',
                description:
                  'Schedule, assign interviewers, and sync with Google, Zoom or Teams automatically.',
              },
              {
                icon: Sparkles,
                title: 'AI that assists, never decides',
                description:
                  'Draft job descriptions, check inclusive language, parse CVs — always advisory, always your call.',
              },
              {
                icon: Share2,
                title: 'Share & collect applies',
                description:
                  'A branded public careers page + one-click LinkedIn share. Applications land straight in your pipeline.',
              },
              {
                icon: BarChart3,
                title: 'Reports that mean something',
                description:
                  'Time-to-hire, source effectiveness and funnel conversion — powered by the same consistent scorecards.',
              },
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
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Choose the plan that fits your hiring needs
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
            Ready to hire with structure?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            Start a 7-day free trial. Set up your first role in minutes.
          </p>
          <Button size="lg" variant="secondary" className="mt-8" asChild>
            <Link href="/auth/sign-up">
              Start your free trial
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
                Guides
              </Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">
                Terms and Conditions
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/refund" className="transition-colors hover:text-foreground">
                Refund Policy
              </Link>
            </div>

            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} HRHandle. All rights reserved.
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
