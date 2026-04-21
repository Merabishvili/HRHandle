import type { UUID, ISODateString, ISODateTimeString } from './common'
import type { Candidate } from './candidate'
import type { Vacancy } from './vacancy'

export interface ApplicationStatus {
  id: UUID
  name: string
  code: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn'
  is_active: boolean
  sort_order: number
  created_at?: ISODateTimeString
  updated_at?: ISODateTimeString
}

export interface Application {
  id: UUID
  organization_id: UUID

  candidate_id: UUID
  vacancy_id: UUID
  status_id: UUID | null

  applied_at: ISODateTimeString
  last_status_changed_at: ISODateTimeString | null
  notes: string | null

  created_by: UUID | null
  created_at: ISODateTimeString
  updated_at: ISODateTimeString
  deleted_at: ISODateTimeString | null

  // joined fields
  candidate?: Candidate | null
  vacancy?: Vacancy | null
  status?: ApplicationStatus | null
}

export interface ApplicationFormData {
  candidate_id: UUID
  vacancy_id: UUID
  status_id?: UUID | null
  notes?: string | null
}

export interface ApplicationFilters {
  search?: string
  vacancy_id?: UUID
  candidate_id?: UUID
  status_id?: UUID
  sector_id?: UUID
  applied_from?: ISODateString
  applied_to?: ISODateString
  page?: number
  page_size?: number
}

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus['code'], string> = {
  applied: 'bg-blue-100 text-blue-800',
  screening: 'bg-yellow-100 text-yellow-800',
  interview: 'bg-purple-100 text-purple-800',
  offer: 'bg-cyan-100 text-cyan-800',
  hired: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-slate-100 text-slate-800',
}
