import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { acceptInvitation } from '@/lib/actions/invitations'

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    redirect('/auth/error')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not logged in — send to login, come back here after
  if (!user) {
    redirect(`/auth/sign-up?next=${encodeURIComponent(`/join?token=${token}`)}`)
  }

  const result = await acceptInvitation(token)

  if (!result.success) {
    redirect(`/auth/error?message=${encodeURIComponent(result.error)}`)
  }

  redirect('/dashboard')
}
