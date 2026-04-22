import type { Vacancy } from './vacancy'
import type { Candidate } from './candidate'
import type { Application } from './application'
import type { ActivityLog } from './activity'
import type { PlanUsage } from './subscription'

export interface DashboardStats {
  total_vacancies: number
  open_vacancies: number
  total_candidates: number
  active_applications: number
  interviews_this_week: number
  hired_this_month: number
}

export interface DashboardData {
  stats: DashboardStats
  recent_vacancies: Vacancy[]
  recent_candidates: Candidate[]
  recent_applications: Application[]
  recent_activities: ActivityLog[]
  plan_usage: PlanUsage
}
