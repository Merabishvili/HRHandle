import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Users,
  Briefcase,
  Calendar,
  BarChart3,
  ArrowRight,
  Shield,
  Globe,
} from 'lucide-react'
import { PRICING_PLANS } from '@/lib/types/subscription'
import { isCampaignActive, CAMPAIGN } from '@/lib/campaign'
import { PricingSection } from '@/components/landing/pricing-section'

export const metadata: Metadata = {
  alternates: {
    canonical: 'https://hrhandle.com',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'HRHandle',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://hrhandle.com',
  description:
    'HRHandle is a modern applicant tracking system that helps teams manage vacancies, track candidates, and schedule interviews.',
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
    url: 'https://hrhandle.com',
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Briefcase className="h-5 w-5 text-primary-foreground" />
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
              Streamline your hiring process
            </div>

            <h1 className="text-balance text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              Hire smarter with <span className="text-primary">HRHandle</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
              The modern applicant tracking system that helps you manage vacancies,
              track candidates, and build your dream team efficiently.
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
          </div>

          <div className="mt-20 grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { label: 'Companies Trust Us', value: '2,000+' },
              { label: 'Candidates Processed', value: '500K+' },
              { label: 'Time Saved', value: '60%' },
              { label: 'Hiring Success Rate', value: '95%' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-foreground sm:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-card px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              Everything you need to hire better
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Powerful features designed to simplify your recruitment workflow
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Briefcase,
                title: 'Vacancy Management',
                description:
                  'Create and manage job postings with customizable fields, status tracking, and team collaboration.',
              },
              {
                icon: Users,
                title: 'Candidate Tracking',
                description:
                  'Track candidates through your hiring pipeline with structured statuses and linked applications.',
              },
              {
                icon: Calendar,
                title: 'Interview Scheduling',
                description:
                  'Schedule interviews, assign interviewers, and keep all interview activity in one place.',
              },
              {
                icon: BarChart3,
                title: 'Analytics & Reports',
                description:
                  'Get insights into hiring activity with dashboard metrics and reporting-ready summaries.',
              },
              {
                icon: Shield,
                title: 'Team Collaboration',
                description:
                  'Invite team members, assign roles, and collaborate on hiring decisions securely.',
              },
              {
                icon: Globe,
                title: 'Structured Hiring Workflow',
                description:
                  'Manage vacancies, applications, candidate progress, and interviews with one consistent process.',
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
            Ready to transform your hiring?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
            Start with a 7-day free trial, link your payment method, and continue
            with a paid plan when your trial ends.
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
                <Briefcase className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">HRHandle</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
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