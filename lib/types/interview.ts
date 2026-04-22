import type { UUID, ISODateTimeString } from './common'
import type { Candidate } from './candidate'
import type { Vacancy } from './vacancy'
import type { Application } from './application'
import type { Profile } from './organization'

export type InterviewType = 'phone' | 'video' | 'onsite'
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface Interview {
  id: UUID
  organization_id: UUID

  candidate_id: UUID
  vacancy_id: UUID
  application_id: UUID | null

  interviewer_id: UUID | null
  scheduled_at: ISODateTimeString
  duration_minutes: number

  type: InterviewType
  status: InterviewStatus
  feedback: string | null
  rating: number | null

  created_at: ISODateTimeString
  updated_at: ISODateTimeString

  // joined fields
  candidate?: Candidate | null
  interviewer?: Profile | null
  vacancy?: Vacancy | null
  application?: Application | null
}

export interface InterviewFormData {
  candidate_id: UUID
  vacancy_id: UUID
  application_id?: UUID | null
  interviewer_id?: UUID | null
  scheduled_at: ISODateTimeString
  duration_minutes: number
  type: InterviewType
}
