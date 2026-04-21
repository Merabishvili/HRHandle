'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Profile, Organization, Subscription } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Briefcase,
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  CreditCard,
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
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Vacancies', href: '/vacancies', icon: Briefcase },
  { name: 'Candidates', href: '/candidates', icon: Users },
  { name: 'Interviews', href: '/interviews', icon: Calendar },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Subscription', href: '/subscription', icon: CreditCard },
]

function getPlanLabel(subscription?: Subscription | null): string {
  if (!subscription) return 'Trial'

  if (subscription.plan_code === 'professional') {
    return 'Professional'
  }

  return 'Trial'
}

export function DashboardSidebar({
  organization,
  subscription,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen((prev: boolean) => !prev)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
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
                Organization
              </p>
              <p className="mt-1 truncate text-sm font-medium text-sidebar-foreground">
                {organization.name}
              </p>
            </div>
          )}

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-sidebar-border px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-sidebar-foreground/60">Plan</span>
              <span className="text-xs font-medium capitalize text-sidebar-primary">
                {getPlanLabel(subscription)}
              </span>
            </div>

            {subscription?.status && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-sidebar-foreground/60">Status</span>
                <span className="text-xs font-medium capitalize text-sidebar-foreground">
                  {subscription.status.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}