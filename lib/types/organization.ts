import type { UUID, ISODateTimeString } from './common'

export type UserRole = 'owner' | 'admin' | 'member'

export interface Organization {
  id: UUID
  name: string
  slug: string
  logo_url: string | null
  is_active: boolean
  created_at: ISODateTimeString
  updated_at: ISODateTimeString
}

export interface Profile {
  id: UUID
  organization_id: UUID | null
  full_name: string
  email: string | null
  avatar_url: string | null
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: ISODateTimeString
  updated_at: ISODateTimeString
}

export interface ProfileFormData {
  full_name: string
  email?: string | null
  phone?: string | null
}

export interface ChangePasswordFormData {
  current_password: string
  new_password: string
  confirm_password: string
}
