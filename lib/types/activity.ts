import type { UUID, ISODateTimeString } from './common'
import type { Profile } from './organization'

export interface ActivityLog {
  id: UUID
  organization_id: UUID
  user_id: UUID | null

  entity_type: string
  entity_id: UUID | null
  action: string
  message: string | null
  details: Record<string, unknown> | null

  created_at: ISODateTimeString

  // joined fields
  user?: Profile | null
}
