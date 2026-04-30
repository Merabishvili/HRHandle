import type { UUID, ISODateString, ISODateTimeString } from './common'
import type { Profile } from './organization'

export interface CandidateGeneralStatus {
  id: UUID
  name: string
  code: 'active' | 'hired' | 'archived'
  is_active: boolean
  sort_order: number
  created_at?: ISODateTimeString
  updated_at?: ISODateTimeString
}

export interface Candidate {
  id: UUID
  organization_id: UUID

  first_name: string
  last_name: string
  date_of_birth: ISODateString | null
  email: string | null
  phone: string | null

  current_company: string | null
  current_position: string | null
  years_of_experience: number | null

  linkedin_profile_url: string | null
  source: string | null
  general_status_id: UUID | null

  created_by: UUID | null
  created_at: ISODateTimeString
  updated_at: ISODateTimeString
  deleted_at: ISODateTimeString | null

  // joined / computed fields
  general_status?: CandidateGeneralStatus | null
  applications_count?: number
}

export type CandidateDocumentType = 'cv' | 'resume' | 'cover_letter' | 'other'

export interface CandidateDocument {
  id: UUID
  organization_id: UUID
  candidate_id: UUID

  document_type: CandidateDocumentType
  file_name: string
  file_path: string
  mime_type: string | null
  file_size_bytes: number | null

  uploaded_by: UUID | null
  created_at: ISODateTimeString
  deleted_at: ISODateTimeString | null
}

export interface CandidateNote {
  id: UUID
  organization_id: UUID
  candidate_id: UUID

  note_text: string

  created_by: UUID | null
  created_at: ISODateTimeString
  updated_at: ISODateTimeString
  deleted_at: ISODateTimeString | null

  // joined fields
  author?: Profile | null
}

export interface CandidateFormData {
  first_name: string
  last_name: string
  date_of_birth?: ISODateString | null

  email?: string | null
  phone?: string | null

  current_company?: string | null
  current_position?: string | null
  years_of_experience?: number | null

  linkedin_profile_url?: string | null
  source?: string | null

  general_status_id?: UUID | null

  linked_vacancy_ids?: UUID[]
}

export interface CandidateNoteFormData {
  note_text: string
}

export interface CandidateDocumentFormData {
  document_type: CandidateDocumentType
  file: File
}

export interface CandidateFilters {
  search?: string
  general_status_id?: UUID
  vacancy_id?: UUID
  current_company?: string
  experience_min?: number
  experience_max?: number
  created_from?: ISODateString
  created_to?: ISODateString
  updated_from?: ISODateString
  updated_to?: ISODateString
  page?: number
  page_size?: number
}

export const CANDIDATE_GENERAL_STATUS_COLORS: Record<CandidateGeneralStatus['code'], string> = {
  active: 'bg-green-100 text-green-800',
  hired: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-100 text-slate-800',
}

export function getCandidateFullName(
  candidate: Pick<Candidate, 'first_name' | 'last_name'>
): string {
  return `${candidate.first_name} ${candidate.last_name}`.trim()
}

export function getCandidateInitials(
  candidate: Pick<Candidate, 'first_name' | 'last_name'>
): string {
  return `${candidate.first_name?.[0] || ''}${candidate.last_name?.[0] || ''}`.toUpperCase()
}
