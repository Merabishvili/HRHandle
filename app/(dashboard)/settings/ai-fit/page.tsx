import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getAiFitOversight } from '@/lib/actions/ai-fit'

/**
 * AI oversight (Settings → Data, admin-only). The bias-review surface for
 * Wave 3.1: usage vs cap, the human agree / override split, and the override
 * log with reasons. Renders nothing sensitive — no candidate PII, no scores.
 */
export default async function AiFitOversightPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) redirect('/pipeline')
  const isAdmin = profile.role === 'owner' || profile.role === 'admin'
  if (!isAdmin) redirect('/settings/profile')

  const result = await getAiFitOversight()
  // Graceful pre-migration state: the table/columns don't exist yet.
  const data = result.success
    ? result.data
    : { usedThisMonth: 0, monthlyCap: 100, agreeCount: 0, overrideCount: 0, pendingCount: 0, recentOverrides: [] }

  const reviewed = data.agreeCount + data.overrideCount
  const overrideRate = reviewed > 0 ? Math.round((data.overrideCount / reviewed) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Sparkles className="h-5 w-5" />
          AI oversight
        </h2>
        <p className="text-sm text-muted-foreground">
          AI Fit Analysis is advisory only — every result is reviewed by a person who records an assessment. This page
          tracks usage and the override log so you can watch for skew. A rising override rate can signal the model is
          out of step with your judgement. Read-only.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Used this month" value={`${data.usedThisMonth} / ${data.monthlyCap}`} />
        <Stat label="Agreed" value={String(data.agreeCount)} />
        <Stat label="Overridden" value={String(data.overrideCount)} />
        <Stat label="Override rate" value={`${overrideRate}%`} />
      </div>

      {data.pendingCount > 0 && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {data.pendingCount} {data.pendingCount === 1 ? 'analysis is' : 'analyses are'} awaiting a reviewer&apos;s
          assessment. AI results carry no weight until a person signs off.
        </p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Override log</h3>
        {data.recentOverrides.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No overrides recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {data.recentOverrides.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{o.reason || <span className="italic text-muted-foreground">No reason recorded</span>}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Analysis met {o.meets_count} of {o.must_have_total} must-haves
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {o.assessed_at ? new Date(o.assessed_at).toLocaleDateString() : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Every run, agreement and override is also recorded in the{' '}
        <a href="/settings/audit-log" className="underline">audit log</a> with the full actor and timestamp.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
