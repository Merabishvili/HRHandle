import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CandidateForm } from '@/components/candidates/candidate-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function EditCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/dashboard')
  }

  const { data: candidate } = await supabase
    .from('candidates')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!candidate) {
    notFound()
  }

  // Get active vacancies for the dropdown
  const { data: vacancies } = await supabase
    .from('vacancies')
    .select('id, title')
    .eq('organization_id', profile.organization_id)
    .in('status', ['active', 'draft'])
    .order('title')

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/candidates/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Candidate</h1>
          <p className="text-muted-foreground">Update candidate information.</p>
        </div>
      </div>

      <CandidateForm 
        candidate={candidate}
        vacancies={vacancies || []}
        organizationId={profile.organization_id}
      />
    </div>
  )
}
