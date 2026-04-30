import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsNav } from '@/components/settings/settings-nav'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and organization settings.</p>
      </div>

      <div className="flex gap-10">
        <SettingsNav role={profile.role as 'owner' | 'admin' | 'member'} />
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
