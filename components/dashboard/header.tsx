'use client'

import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Profile, Organization, Subscription } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
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
import { LogOut, User as UserIcon, Settings, CreditCard } from 'lucide-react'

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

export function DashboardHeader({
  user,
  profile,
  organization,
  subscription,
}: DashboardHeaderProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initials = getInitials(profile, user)

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background">
      <div className="flex h-full items-center justify-between px-4 lg:px-8">
        <div className="w-10 lg:hidden" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {organization && (
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-sm font-medium">{organization.name}</p>
              {subscription && (
                <p className="text-xs text-muted-foreground">
                  {subscription.plan_code === 'individual' ? 'Individual' : subscription.plan_code === 'organization' ? 'Organization' : 'Trial'} ·{' '}
                  {subscription.status.replace('_', ' ')}
                </p>
              )}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={profile.avatar_url || undefined}
                  alt={profile.full_name || 'User'}
                />
                <AvatarFallback className="bg-primary text-primary-foreground">
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

            <DropdownMenuItem onClick={() => router.push('/subscription')}>
              <CreditCard className="mr-2 h-4 w-4" />
              Subscription
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}