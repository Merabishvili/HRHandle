export interface ColumnDef {
  key: string
  label: string
}

export const OPTIONAL_CANDIDATE_COLUMNS: ColumnDef[] = [
  { key: 'current_position', label: 'Current Position' },
  { key: 'current_company', label: 'Current Company' },
  { key: 'created_at', label: 'Added Date' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'years_of_experience', label: 'Experience' },
  { key: 'source', label: 'Source' },
]

export const DEFAULT_CANDIDATE_COLUMNS = ['current_position', 'current_company', 'created_at']

export const OPTIONAL_VACANCY_COLUMNS: ColumnDef[] = [
  { key: 'department', label: 'Department' },
  { key: 'location', label: 'Location' },
  { key: 'end_date', label: 'End Date' },
  { key: 'employment_type', label: 'Type' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'openings_count', label: 'Openings' },
  { key: 'hiring_manager_name', label: 'Hiring Manager' },
]

export const DEFAULT_VACANCY_COLUMNS = ['department', 'location', 'end_date']

export const MAX_OPTIONAL_COLUMNS = 3

export const CANDIDATE_SORT_OPTIONS = [
  { value: 'created_desc', label: 'Added: Newest first' },
  { value: 'created_asc', label: 'Added: Oldest first' },
  { value: 'experience_desc', label: 'Experience: High to low' },
  { value: 'experience_asc', label: 'Experience: Low to high' },
  { value: 'status', label: 'Status' },
]

export const VACANCY_SORT_OPTIONS = [
  { value: 'created_desc', label: 'Added: Newest first' },
  { value: 'created_asc', label: 'Added: Oldest first' },
  { value: 'end_asc', label: 'End date: Soonest first' },
  { value: 'end_desc', label: 'End date: Latest first' },
  { value: 'status', label: 'Status' },
]
