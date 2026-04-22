import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LayoutGrid } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from '@/components/pipeline/kanban-board'
import type { ApplicationStatus } from '@/lib/types/application'

interface PipelineApplicationRow {
  id: string
  candidate_id: string
  status_id: string | null
  applied_at: string
  last_status_changed_at: string | null
  candidates: {
    first_name: string
    last_name: string
    current_position: string | null
    current_company: string | null
  }[] | null
}

export default async function VacancyPipelinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id
  if (!organizationId) redirect('/dashboard')

  const [
    { data: vacancy },
    { data: statusesRaw },
    { data: applicationsRaw },
  ] = await Promise.all([
    supabase
      .from('vacancies')
      .select('id, title')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .single(),

    supabase
      .from('application_statuses')
      .select('id, name, code, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),

    supabase
      .from('applications')
      .select(`
        id,
        candidate_id,
        status_id,
        applied_at,
        last_status_changed_at,
        candidates (
          first_name,
          last_name,
          current_position,
          current_company
        )
      `)
      .eq('vacancy_id', id)
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('applied_at', { ascending: true }),
  ])

  if (!vacancy) notFound()

  const statuses = (statusesRaw || []) as ApplicationStatus[]
  const applicationsData = (applicationsRaw || []) as PipelineApplicationRow[]

  const firstStatusId = statuses[0]?.id ?? null

  const applications = applicationsData.map((app) => {
    const candidate = app.candidates?.[0]
    return {
      id: app.id,
      candidate_id: app.candidate_id,
      status_id: app.status_id ?? firstStatusId,
      first_name: candidate?.first_name ?? 'Unknown',
      last_name: candidate?.last_name ?? '',
      current_position: candidate?.current_position ?? null,
      current_company: candidate?.current_company ?? null,
      last_status_changed_at: app.last_status_changed_at,
      applied_at: app.applied_at,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/vacancies/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold text-foreground">{vacancy.title}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {applications.length} candidate{applications.length !== 1 ? 's' : ''} in pipeline
            </p>
          </div>
        </div>

        <Button variant="outline" asChild>
          <Link href={`/vacancies/${id}`}>View Details</Link>
        </Button>
      </div>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <LayoutGrid className="h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">No candidates yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add candidates to this vacancy to see them in the pipeline.
          </p>
          <Button className="mt-6" asChild>
            <Link href={`/candidates/new?vacancy=${id}`}>Add Candidate</Link>
          </Button>
        </div>
      ) : (
        <KanbanBoard statuses={statuses} initialApplications={applications} />
      )}
    </div>
  )
}
