import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Upload, BarChart3, Briefcase, Users, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

/**
 * Top-level /pipeline route — Wave 2.1 placeholder.
 *
 * The full global Pipeline (cross-vacancy kanban + role chips + Review mode)
 * is Wave 2.1's big-ticket item and is not yet built. Until it lands, this
 * route serves two scenarios:
 *
 *   1. Recruiter has at least one open or draft vacancy → redirect to that
 *      vacancy's existing /vacancies/[id]/pipeline board. Single-vacancy
 *      orgs (the common case during early adoption) land directly on the
 *      board they want; multi-vacancy orgs land on whichever was opened
 *      most recently as a reasonable default.
 *
 *   2. Recruiter has zero vacancies → render the welcome card from
 *      `redesign/Pipeline Empty State.dc.html` (locked per Q-S01-e). One
 *      primary CTA ("Create your first vacancy"), one secondary
 *      ("Import candidates" — links to the CSV import wizard), plus a
 *      3-step orientation strip.
 *
 * Wave 2.1 replaces this with the real org-wide kanban + role chips.
 */
export default async function PipelinePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  // Pick the most recently-created vacancy worth opening for. Prefer open
  // statuses (where active recruiting is happening); fall back to draft so
  // first-time users still land on something useful right after the
  // create-vacancy flow; final fallback to anything non-archived.
  const { data: vacancies } = await supabase
    .from('vacancies')
    .select('id, vacancy_statuses(code)')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  type VacancyRow = { id: string; vacancy_statuses: { code: string } | { code: string }[] | null }
  const rows = (vacancies ?? []) as VacancyRow[]
  const codeOf = (v: VacancyRow): string | null => {
    const j = v.vacancy_statuses
    if (!j) return null
    return Array.isArray(j) ? j[0]?.code ?? null : j.code
  }

  const target =
    rows.find((v) => codeOf(v) === 'open') ??
    rows.find((v) => codeOf(v) === 'draft') ??
    rows[0] ??
    null

  if (target?.id) {
    redirect(`/vacancies/${target.id}/pipeline`)
  }

  // No vacancies yet — welcome card
  return (
    <div className="relative -mx-4 -my-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden lg:-mx-8 lg:-my-8">
      <div className="relative z-10 mx-auto w-full max-w-[560px] px-6 text-center">
        <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-primary/10">
          <BarChart3 className="h-9 w-9 text-primary" />
        </div>
        <h2 className="text-[26px] font-bold leading-tight text-foreground">
          Welcome to HRHandle <Sparkles className="inline h-6 w-6 text-amber-500" />
        </h2>
        <p className="mx-auto mt-3 max-w-[460px] text-[15.5px] leading-relaxed text-muted-foreground">
          This is your pipeline — every candidate across every role, in one
          place. To get started, create your first vacancy and your board
          comes to life.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link href="/vacancies/new">
              <Plus className="h-4 w-4" />
              Create your first vacancy
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/candidates/import">
              <Upload className="h-4 w-4" />
              Import candidates
            </Link>
          </Button>
        </div>

        <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
          {[
            {
              n: 1,
              icon: Briefcase,
              title: 'Create a vacancy',
              body: 'Add the role, let AI draft the description, set a scorecard.',
            },
            {
              n: 2,
              icon: Users,
              title: 'Add candidates',
              body: 'Share the apply link or upload CVs — they land here automatically.',
            },
            {
              n: 3,
              icon: BarChart3,
              title: 'Work the pipeline',
              body: 'Move people through stages, score interviews, send offers.',
            },
          ].map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.n}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {step.n}
                  </span>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">
                  {step.title}
                </p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  {step.body}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
