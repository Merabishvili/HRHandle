import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// Global lookup tables change rarely — cache them for 1 hour.
// Call revalidateTag('lookup-vacancy-statuses') etc. if you ever update these tables.

export const getVacancyStatuses = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('vacancy_statuses')
      .select('id, name, code, is_active, sort_order')
      .order('sort_order', { ascending: true })
    return data ?? []
  },
  ['vacancy-statuses'],
  { revalidate: 3600, tags: ['lookup-vacancy-statuses'] }
)

export const getCandidateStatuses = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('candidate_statuses')
      .select('id, name, code, is_active, sort_order')
      .order('sort_order', { ascending: true })
    return data ?? []
  },
  ['candidate-statuses'],
  { revalidate: 3600, tags: ['lookup-candidate-statuses'] }
)

export const getApplicationStatuses = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('application_statuses')
      .select('id, name, code, is_active, sort_order')
      .order('sort_order', { ascending: true })
    return data ?? []
  },
  ['application-statuses'],
  { revalidate: 3600, tags: ['lookup-application-statuses'] }
)
