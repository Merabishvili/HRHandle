'use client'

import { useRouter, usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Profile, Organization, Subscription } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { clearSessionTracking } from '@/lib/session'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, User as UserIcon, Settings, CreditCard, ChevronRight } from 'lucide-react'
import { NotificationsBell } from '@/components/dashboard/notifications-bell'
import { SearchTrigger } from '@/components/global-search/search-trigger'
import { HelpLink } from '@/components/dashboard/help-link'
import { TrialPill } from '@/components/dashboard/trial-pill'

interface DashboardHeaderProps {
  user: User
  profile: Profile
  organization: Organization | null
  subscription?: Subscription | null
}

function getInitials(profile: Profile, user: User): string {
  if (profile.full_name?.trim()) {
    return profile.full_name
      .split(' ')
      .map((name: string) => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return user.email?.slice(0, 2).toUpperCase() || 'U'
}

const PAGE_LABELS: Record<string, string> = {
  '/pipeline': 'Pipeline',
  '/vacancies': 'Vacancies',
  '/candidates': 'Candidates',
  '/interviews': 'Interviews',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

function getPlanLabel(subscription?: Subscription | null): string {
  if (!subscription) return 'Trial'
  if (subscription.plan_code === 'individual') return 'Individual'
  if (subscription.plan_code === 'organization') return 'Organization'
  return 'Trial'
}

export function DashboardHeader({
  user,
  profile,
  organization: _organization,
  subscription,
}: DashboardHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const pageLabel = Object.entries(PAGE_LABELS).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? ''

  const handleSignOut = async () => {
    clearSessionTracking()
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initials = getInitials(profile, user)
  const planLabel = getPlanLabel(subscription)

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-card">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        <div className="w-10 lg:hidden" />

        {/* Breadcrumb */}
        <div className="hidden lg:flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">HRHandle</span>
          {pageLabel && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <span className="font-medium text-foreground">{pageLabel}</span>
            </>
          )}
        </div>

        {/* User area */}
        <div className="flex items-center gap-1.5">
          <TrialPill
            trialEndAt={subscription?.trial_end_at ?? null}
            status={subscription?.status ?? null}
          />
          <SearchTrigger />
          <HelpLink />
          <NotificationsBell />

          <div className="hidden text-right md:block">
            <p className="text-sm font-medium leading-tight text-foreground">
              {profile.full_name || user.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-xs leading-tight text-muted-foreground capitalize">
              {planLabel}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full"
                aria-label={`Account menu for ${profile.full_name || user.email || 'user'}`}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage
                    src={profile.avatar_url || undefined}
                    alt=""
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {profile.full_name || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <UserIcon className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => router.push('/settings/billing')}>
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}