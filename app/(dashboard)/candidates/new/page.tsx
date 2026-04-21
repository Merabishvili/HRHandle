import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CandidateForm } from '@/components/candidates/candidate-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function NewCandidatePage({
  searchParams,
}: {
  searchParams: Promise<{ vacancy?: string }>
}) {
  const { vacancy: defaultVacancyId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  const organizationId = profile.organization_id

  // ✅ fetch everything in parallel (cleaner + faster)
  const [
    { data: vacancies },
    { data: candidateStatuses },
    { data: applicationStatuses },
  ] = await Promise.all([
    supabase
      .from('vacancies')
      .select('id, title')
      .eq('organization_id', organizationId)
      .order('title'),

    supabase
      .from('candidate_statuses')
      .select('id, name, code, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),

    supabase
      .from('application_statuses')
      .select('id, code')
      .eq('is_active', true),
  ])

  // ✅ find default "new" status
  const defaultApplicationStatus =
    applicationStatuses?.find((s) => s.code === 'new') || null

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/candidates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Candidate</h1>
          <p className="text-muted-foreground">Add a new candidate to your pipeline.</p>
        </div>
      </div>

      <CandidateForm
        vacancies={(vacancies || []) as any}
        defaultVacancyId={defaultVacancyId}
        candidateStatuses={(candidateStatuses || []) as any}
        defaultApplicationStatusId={defaultApplicationStatus?.id || null}
      />
    </div>
  )
}