'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Profile, Organization } from '@/lib/types'
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
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Vacancies', href: '/vacancies', icon: Briefcase },
  { name: 'Candidates', href: '/candidates', icon: Users },
  { name: 'Interviews', href: '/interviews', icon: Calendar },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Subscription', href: '/subscription', icon: CreditCard },
]

export function DashboardSidebar({ organization }: DashboardSidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform lg:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">HRHandle</span>
          </div>

          {/* Organization */}
          {organization && (
            <div className="px-6 py-4 border-b border-sidebar-border">
              <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider">Organization</p>
              <p className="mt-1 text-sm font-medium text-sidebar-foreground truncate">
                {organization.name}
              </p>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Subscription badge */}
          {organization && (
            <div className="px-6 py-4 border-t border-sidebar-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-sidebar-foreground/60">Plan</span>
                <span className="text-xs font-medium text-sidebar-primary capitalize">
                  {organization.subscription_tier}
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
