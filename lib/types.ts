// Database types for HRHandle ATS

export type SubscriptionTier = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due'
export type UserRole = 'owner' | 'admin' | 'member'
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship'
export type VacancyStatus = 'draft' | 'active' | 'paused' | 'closed'
export type CandidateStatus = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
export type InterviewType = 'phone' | 'video' | 'onsite'
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  subscription_tier: SubscriptionTier
  subscription_status: SubscriptionStatus
  max_vacancies: number
  max_users: number
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Vacancy {
  id: string
  organization_id: string
  title: string
  department: string | null
  location: string | null
  employment_type: EmploymentType
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  description: string | null
  requirements: string | null
  status: VacancyStatus
  created_by: string | null
  created_at: string
  updated_at: string
  // Computed fields
  candidates_count?: number
}

export interface Candidate {
  id: string
  organization_id: string
  vacancy_id: string | null
  full_name: string
  email: string
  phone: string | null
  resume_url: string | null
  linkedin_url: string | null
  status: CandidateStatus
  rating: number | null
  notes: string | null
  source: string | null
  applied_at: string
  created_at: string
  updated_at: string
  // Joined fields
  vacancy?: Vacancy
}

export interface Interview {
  id: string
  candidate_id: string
  vacancy_id: string
  interviewer_id: string | null
  scheduled_at: string
  duration_minutes: number
  type: InterviewType
  status: InterviewStatus
  feedback: string | null
  rating: number | null
  created_at: string
  updated_at: string
  // Joined fields
  candidate?: Candidate
  interviewer?: Profile
  vacancy?: Vacancy
}

export interface ActivityLog {
  id: string
  organization_id: string
  user_id: string | null
  entity_type: string
  entity_id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
  // Joined fields
  user?: Profile
}

// Stats and dashboard types
export interface DashboardStats {
  total_vacancies: number
  active_vacancies: number
  total_candidates: number
  new_candidates: number
  interviews_this_week: number
  hired_this_month: number
}

// Form types
export interface VacancyFormData {
  title: string
  department?: string
  location?: string
  employment_type: EmploymentType
  salary_min?: number
  salary_max?: number
  salary_currency: string
  description?: string
  requirements?: string
  status: VacancyStatus
}

export interface CandidateFormData {
  full_name: string
  email: string
  phone?: string
  vacancy_id?: string
  resume_url?: string
  linkedin_url?: string
  source?: string
  notes?: string
}

export interface InterviewFormData {
  candidate_id: string
  vacancy_id: string
  interviewer_id?: string
  scheduled_at: string
  duration_minutes: number
  type: InterviewType
}

// Pricing plans
export interface PricingPlan {
  name: string
  tier: SubscriptionTier
  price: number
  features: string[]
  max_vacancies: number
  max_users: number
  popular?: boolean
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: 'Free',
    tier: 'free',
    price: 0,
    max_vacancies: 3,
    max_users: 1,
    features: [
      'Up to 3 job postings',
      'Basic candidate tracking',
      'Email notifications',
      'Single user access',
    ],
  },
  {
    name: 'Pro',
    tier: 'pro',
    price: 49,
    max_vacancies: 25,
    max_users: 5,
    popular: true,
    features: [
      'Up to 25 job postings',
      'Advanced analytics',
      'Interview scheduling',
      'Team collaboration (5 users)',
      'Custom pipeline stages',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    tier: 'enterprise',
    price: 149,
    max_vacancies: -1, // unlimited
    max_users: -1, // unlimited
    features: [
      'Unlimited job postings',
      'Advanced reporting',
      'API access',
      'Unlimited team members',
      'SSO integration',
      'Dedicated account manager',
      'Custom integrations',
    ],
  },
]

// Status colors mapping
export const CANDIDATE_STATUS_COLORS: Record<CandidateStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  screening: 'bg-yellow-100 text-yellow-800',
  interview: 'bg-purple-100 text-purple-800',
  offer: 'bg-cyan-100 text-cyan-800',
  hired: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export const VACANCY_STATUS_COLORS: Record<VacancyStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-red-100 text-red-800',
}
