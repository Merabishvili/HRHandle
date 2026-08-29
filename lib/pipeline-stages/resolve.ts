/**
 * Wave 2.6 Slice 1 — pure helper for mapping a legacy
 * `application_statuses.code` to the corresponding default
 * `pipeline_stages.name`. The seeder (Migration 046) writes per-vacancy
 * stages with these exact names, so the lookup is deterministic.
 *
 * Lives in its own folder + as a pure function so the apply-path writers
 * can call it without each one re-implementing the switch, and so the
 * mapping is unit-testable without touching Supabase.
 */
export type LegacyStatusCode =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn'

const CODE_TO_DEFAULT_STAGE_NAME: Record<LegacyStatusCode, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export function defaultStageNameForCode(code: LegacyStatusCode): string {
  return CODE_TO_DEFAULT_STAGE_NAME[code]
}

/**
 * Server-side resolver: given a Supabase client (admin or RLS-scoped),
 * a vacancy id, and a legacy status code, return the `pipeline_stages.id`
 * for the matching default-named row in that vacancy. Returns null when
 * the vacancy has no pipeline_stages rows yet (shouldn't happen after
 * Migration 049's backfill + the seeder hook in createVacancy, but be
 * defensive — a null return means callers should leave pipeline_stage_id
 * unset rather than throw).
 *
 * Typed against the bits of the supabase client we use; intentionally
 * loose so both `createClient()` and `createAdminClient()` callers
 * compile without each wrapping their own type.
 */
export interface StageLookupClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

export async function resolvePipelineStageId(
  client: StageLookupClient,
  vacancyId: string,
  code: LegacyStatusCode,
): Promise<string | null> {
  const name = defaultStageNameForCode(code)
  const { data } = await client
    .from('pipeline_stages')
    .select('id')
    .eq('vacancy_id', vacancyId)
    .ilike('name', name)
    .maybeSingle()
  return (data?.id as string | null) ?? null
}

/**
 * Origin-link resolver: given a Main-pipeline template id and a vacancy,
 * return the vacancy's `pipeline_stages.id` that was seeded from that
 * template (`origin_template_id = templateId`). This is the robust
 * cross-vacancy-board move path — it does NOT depend on the stage name,
 * so a renamed stage still resolves correctly (unlike the name-based
 * `resolvePipelineStageId`). Returns null when the vacancy has no stage
 * linked to that template (e.g. the recruiter removed the inherited
 * stage) — callers then fall back to code/name resolution.
 */
export async function resolvePipelineStageByTemplate(
  client: StageLookupClient,
  vacancyId: string,
  templateId: string,
): Promise<string | null> {
  const { data } = await client
    .from('pipeline_stages')
    .select('id')
    .eq('vacancy_id', vacancyId)
    .eq('origin_template_id', templateId)
    .maybeSingle()
  return (data?.id as string | null) ?? null
}
