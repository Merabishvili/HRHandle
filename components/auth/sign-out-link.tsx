'use client'

import { useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearSessionTracking } from '@/lib/session'

/**
 * Flexible sign-out wrapper. Renders the provided children inside a clickable
 * shell that calls Supabase sign-out and routes to /auth/login. Use when you
 * want a non-default button shape (e.g. variant="outline") — pair it with a
 * Button inside. For the standard "Sign out and try again" button, use
 * `SignOutButton` instead.
 */
export function SignOutLink({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    if (isPending) return
    startTransition(async () => {
      clearSessionTracking()
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth/login')
      router.refresh()
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      className={className}
      aria-disabled={isPending}
    >
      {children}
    </div>
  )
}
