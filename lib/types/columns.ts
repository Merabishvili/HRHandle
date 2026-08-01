export interface ColumnDef {
  key: string
  label: string
}

export const OPTIONAL_CANDIDATE_COLUMNS: ColumnDef[] = [
  { key: 'stage', label: 'Stage' },
  { key: 'fit_score', label: 'Fit score' },
  { key: 'current_position', label: 'Current Position' },
  { key: 'current_company', label: 'Current Company' },
  { key: 'created_at', label: 'Added Date' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'years_of_experience', label: 'Experience' },
  { key: 'location', label: 'Location' },
  { key: 'salary_expectation', label: 'Salary expectation' },
  { key: 'notice_period', label: 'Notice period' },
  { key: 'languages', label: 'Languages' },
  { key: 'source', label: 'Source' },
]

export const DEFAULT_CANDIDATE_COLUMNS = ['current_position', 'current_company', 'created_at']

export const OPTIONAL_VACANCY_COLUMNS: ColumnDef[] = [
  { key: 'department', label: 'Department' },
  { key: 'location', label: 'Location' },
  { key: 'end_date', label: 'End Date' },
  // "Type" was ambiguous (employment type vs work mode); the vacancy record
  // only stores employment type, so this is now explicitly labelled.
  { key: 'employment_type', label: 'Employment type' },
  { key: 'work_mode', label: 'Work mode' },
  { key: 'sector', label: 'Sector' },
  { key: 'salary', label: 'Salary range' },
  { key: 'health', label: 'Health' },
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

// i18n key maps — the built-in column + sort labels above are the English
// source; these map each stable value to its catalog key so any surface can
// render `t(...)`. Custom-field columns (cf_<id>) have no entry — they fall
// back to the org-defined field name (candidate/recruiter content, not chrome).
export const COLUMN_I18N_KEY: Record<string, string> = {
  stage: 'columns.stage',
  fit_score: 'columns.fitScore',
  current_position: 'columns.currentPosition',
  current_company: 'columns.currentCompany',
  created_at: 'columns.addedDate',
  email: 'columns.email',
  phone: 'columns.phone',
  years_of_experience: 'columns.experience',
  location: 'columns.location',
  salary_expectation: 'columns.salaryExpectation',
  notice_period: 'columns.noticePeriod',
  languages: 'columns.languages',
  source: 'columns.source',
  department: 'columns.department',
  end_date: 'columns.endDate',
  employment_type: 'columns.employmentType',
  work_mode: 'columns.workMode',
  sector: 'columns.sector',
  salary: 'columns.salaryRange',
  health: 'columns.health',
  start_date: 'columns.startDate',
  openings_count: 'columns.openings',
  hiring_manager_name: 'columns.hiringManager',
}

export const SORT_I18N_KEY: Record<string, string> = {
  created_desc: 'sort.addedNewest',
  created_asc: 'sort.addedOldest',
  experience_desc: 'sort.experienceHighLow',
  experience_asc: 'sort.experienceLowHigh',
  status: 'sort.status',
  end_asc: 'sort.endSoonest',
  end_desc: 'sort.endLatest',
}
