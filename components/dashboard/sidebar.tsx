'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { User } from '@supabase/supabase-js'
import type { Profile, Organization, Subscription } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Briefcase,
  Users,
  Calendar,
  BarChart3,
  KanbanSquare,
  Settings,
  Menu,
  X,
} from 'lucide-react'

interface DashboardSidebarProps {
  user: User
  profile: Profile
  organization: Organization | null
  subscription?: Subscription | null
}

const navigation = [
  { key: 'nav.pipeline', href: '/pipeline', icon: KanbanSquare },
  { key: 'nav.vacancies', href: '/vacancies', icon: Briefcase },
  { key: 'nav.candidates', href: '/candidates', icon: Users },
  { key: 'nav.interviews', href: '/interviews', icon: Calendar },
  { key: 'nav.reports', href: '/reports', icon: BarChart3 },
  { key: 'nav.settings', href: '/settings', icon: Settings },
]

/** Returns the plan-label translation key (resolved with `t()` in the component). */
function getPlanKey(subscription?: Subscription | null): string {
  if (subscription?.plan_code === 'individual') return 'plan.individual'
  if (subscription?.plan_code === 'organization') return 'plan.organization'
  return 'plan.trial'
}

export function DashboardSidebar({
  profile,
  organization,
  subscription,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const t = useTranslations()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const visibleNavigation = navigation

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={isMobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
        aria-expanded={isMobileOpen}
        aria-controls="dashboard-sidebar"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen((prev: boolean) => !prev)}
      >
        {isMobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </Button>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        id="dashboard-sidebar"
        aria-label="Primary navigation"
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <Briefcase className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">HRHandle</span>
          </div>

          {organization && (
            <div className="border-b border-sidebar-border px-6 py-4">
              <p className="text-xs uppercase tracking-wider text-sidebar-foreground/60">
                {t('nav.organization')}
              </p>
              <p className="mt-1 truncate text-sm font-medium text-sidebar-foreground">
                {organization.name}
              </p>
            </div>
          )}

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {visibleNavigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {t(item.key)}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-sidebar-border px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-sidebar-foreground/60">{t('sidebar.plan')}</span>
              <span className="text-xs font-medium capitalize text-sidebar-primary">
                {t(getPlanKey(subscription))}
              </span>
            </div>

            {/* Status only shown when it adds information beyond the plan label.
                For trial accounts it just repeats "Trial · Trial" (audit §2.11);
                same for healthy paid plans where status === 'active' is implied. */}
            {subscription?.status &&
              subscription.status !== 'trial' &&
              subscription.status !== 'active' && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-sidebar-foreground/60">{t('sidebar.status')}</span>
                  <span className="text-xs font-medium text-sidebar-foreground">
                    {(() => {
                      const s = subscription.status.replace('_', ' ')
                      return s.charAt(0).toUpperCase() + s.slice(1)
                    })()}
                  </span>
                </div>
              )}

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-sidebar-foreground/40">
              <Link href="/terms" className="transition-colors hover:text-sidebar-foreground/70">{t('sidebar.terms')}</Link>
              <Link href="/privacy" className="transition-colors hover:text-sidebar-foreground/70">{t('sidebar.privacy')}</Link>
              <Link href="/refund" className="transition-colors hover:text-sidebar-foreground/70">{t('sidebar.refund')}</Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}