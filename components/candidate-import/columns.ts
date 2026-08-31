import type { ImportField } from '@/lib/candidate-import/parsing'
import type { ImportErrorCode } from '@/lib/candidate-import/validation'

/** Column display metadata for the review/confirm tables, in template order. */
export interface ColumnMeta {
  field: ImportField
  labelKey: string
  width: number
  required: boolean
}

export const IMPORT_COLUMNS: ColumnMeta[] = [
  { field: 'first_name', labelKey: 'csvImport.col.firstName', width: 92, required: true },
  { field: 'last_name', labelKey: 'csvImport.col.lastName', width: 92, required: true },
  { field: 'email', labelKey: 'csvImport.col.email', width: 172, required: false },
  { field: 'phone', labelKey: 'csvImport.col.phone', width: 124, required: false },
  { field: 'current_company', labelKey: 'csvImport.col.company', width: 104, required: false },
  { field: 'current_position', labelKey: 'csvImport.col.position', width: 112, required: false },
  { field: 'years_of_experience', labelKey: 'csvImport.col.experience', width: 66, required: false },
  { field: 'linkedin_url', labelKey: 'csvImport.col.linkedin', width: 92, required: false },
  { field: 'location', labelKey: 'csvImport.col.location', width: 84, required: false },
  { field: 'source', labelKey: 'csvImport.col.source', width: 76, required: false },
  { field: 'languages', labelKey: 'csvImport.col.languages', width: 96, required: false },
  { field: 'salary_expectation', labelKey: 'csvImport.col.salary', width: 92, required: false },
  { field: 'notice_period', labelKey: 'csvImport.col.notice', width: 84, required: false },
]

export const ERROR_LABEL_KEY: Record<ImportErrorCode, string> = {
  firstNameRequired: 'csvImport.err.firstNameRequired',
  lastNameRequired: 'csvImport.err.lastNameRequired',
  emailInvalid: 'csvImport.err.emailInvalid',
  dupExisting: 'csvImport.err.dupExisting',
  dupInFile: 'csvImport.err.dupInFile',
  phoneInvalid: 'csvImport.err.phoneInvalid',
  yoeInvalid: 'csvImport.err.yoeInvalid',
  linkedinInvalid: 'csvImport.err.linkedinInvalid',
  salaryInvalid: 'csvImport.err.salaryInvalid',
}
