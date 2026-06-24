import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PipelineStagesManager } from '@/components/settings/pipeline-stages-manager'
import { listOrgPipelineStageTemplates } from '@/lib/actions/org-pipeline-stage-templates'

/**
 * A-5 — Settings → Pipeline stages (org-level templates).
 *
 * Owners + admins can customise the default set that gets copied onto
 * every new vacancy via `seed_default_pipeline_stages` in Migration 055.
 * The fallback is the hardcoded Applied / Screening / Interview / Offer
 * / Hired / Rejected / Withdrawn list when an org has no template.
 *
 * Per `Custom Stages.dc.html`, stage name is free-text (any language);
 * behavior is keyed off the stage `type` enum so any number of
 * "Interview" rounds inherit the full interview toolkit.
 */
export default async function PipelineStagesSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/pipeline')
  const isAdmin = profile.role === 'owner' || profile.role === 'admin'
  if (!isAdmin) redirect('/settings/profile')

  const result = await listOrgPipelineStageTemplates()
  const initial = result.success ? result.data : []

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Pipeline stages</h2>
        <p className="text-sm text-muted-foreground">
          The default set every new vacancy starts with. A stage has a name (free-text, any language) and a type — the type drives the actions on the candidate profile, never the name. Capped at 10 stages.
        </p>
      </div>
      <PipelineStagesManager initialStages={initial} />
    </div>
  )
}
