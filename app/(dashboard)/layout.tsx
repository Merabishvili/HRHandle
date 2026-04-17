import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get or create profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  // If no profile exists, create one with a new organization
  if (!profile) {
    const companyName = user.user_metadata?.company_name || 'My Company'
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    // Create organization first
    const { data: newOrg } = await supabase
      .from('organizations')
      .insert({
        name: companyName,
        slug: `${slug}-${Date.now()}`,
      })
      .select()
      .single()

    if (newOrg) {
      // Create profile with organization
      await supabase.from('profiles').insert({
        id: user.id,
        organization_id: newOrg.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        role: 'owner',
      })
    }

    // Redirect to refresh the page with the new data
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar 
        user={user} 
        profile={profile} 
        organization={profile.organizations} 
      />
      <div className="flex-1 flex flex-col lg:ml-64">
        <DashboardHeader 
          user={user} 
          profile={profile} 
          organization={profile.organizations} 
        />
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
