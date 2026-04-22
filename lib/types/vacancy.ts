import type { UUID, ISODateString, ISODateTimeString } from './common'

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship'

export interface Sector {
  id: UUID
  name: string
  code: string
  is_active: boolean
  sort_order: number
  created_at: ISODateTimeString
  updated_at?: ISODateTimeString
}

export interface VacancyStatus {
  id: UUID
  name: string
  code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived'
  is_active: boolean
  sort_order: number
  created_at?: ISODateTimeString
  updated_at?: ISODateTimeString
}

export interface Vacancy {
  id: UUID
  organization_id: UUID

  title: string
  sector_id: UUID | null
  status_id: UUID | null

  department: string | null
  location: string | null
  employment_type: EmploymentType | null
  hiring_manager_name: string | null

  salary_min: number | null
  salary_max: number | null
  salary_currency: string

  openings_count: number
  start_date: ISODateString
  end_date: ISODateString | null

  description: string
  requirements: string | null

  created_by: UUID | null
  created_at: ISODateTimeString
  updated_at: ISODateTimeString
  archived_at: ISODateTimeString | null

  // joined / computed fields
  sector?: Sector | null
  status?: VacancyStatus | null
  applications_count?: number
  candidates_count?: number
}

export interface VacancyFormData {
  title: string
  sector_id?: UUID | null
  status_id?: UUID | null

  department?: string
  location?: string
  employment_type?: EmploymentType | null
  hiring_manager_name?: string

  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string

  openings_count?: number
  start_date: ISODateString
  end_date?: ISODateString | null

  description: string
  requirements?: string | null
}

export interface VacancyFilters {
  search?: string
  status_id?: UUID
  sector_id?: UUID
  start_date_from?: ISODateString
  start_date_to?: ISODateString
  end_date_from?: ISODateString
  end_date_to?: ISODateString
  page?: number
  page_size?: number
}

export const VACANCY_STATUS_COLORS: Record<VacancyStatus['code'], string> = {
  draft: 'bg-gray-100 text-gray-800',
  open: 'bg-green-100 text-green-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-red-100 text-red-800',
  archived: 'bg-slate-100 text-slate-800',
}

export function formatEmploymentType(value: EmploymentType | null | undefined): string {
  if (!value) return 'Not specified'
  switch (value) {
    case 'full_time': return 'Full-time'
    case 'part_time': return 'Part-time'
    case 'contract': return 'Contract'
    case 'internship': return 'Internship'
    default: return value
  }
}

export function formatVacancySalary(
  vacancy: Pick<Vacancy, 'salary_min' | 'salary_max' | 'salary_currency'>
): string | null {
  if (vacancy.salary_min == null && vacancy.salary_max == null) return null

  const min = vacancy.salary_min != null ? vacancy.salary_min.toLocaleString() : null
  const max = vacancy.salary_max != null ? vacancy.salary_max.toLocaleString() : null

  if (min && max) return `${vacancy.salary_currency} ${min} - ${max}`
  if (min) return `${vacancy.salary_currency} ${min}+`
  if (max) return `Up to ${vacancy.salary_currency} ${max}`

  return null
}
