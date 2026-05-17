import { Button } from '@/components/ui/button'
import { Briefcase } from 'lucide-react'

interface VacancyData {
  title: string
  description: string
  responsibilities: string | null
  requirements: string | null
  location: string | null
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null
  application_form_token: string | null
}

interface LinkedInPostJobButtonProps {
  pageId: string
  vacancy: VacancyData
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACT',
  internship: 'INTERNSHIP',
}

function buildDescription(vacancy: VacancyData): string {
  const parts: string[] = [vacancy.description.trim()]
  if (vacancy.responsibilities?.trim()) {
    parts.push(`\n\nResponsibilities\n${vacancy.responsibilities.trim()}`)
  }
  if (vacancy.requirements?.trim()) {
    parts.push(`\n\nRequirements\n${vacancy.requirements.trim()}`)
  }
  const full = parts.join('')
  // LinkedIn job description limit is ~25 000 chars; stay well under URL limits
  return full.length > 5000 ? full.slice(0, 5000) + '…' : full
}

function buildLinkedInJobUrl(pageId: string, vacancy: VacancyData): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hrhandle.com'

  const params = new URLSearchParams()
  params.set('companyId', pageId)
  params.set('title', vacancy.title)
  params.set('description', buildDescription(vacancy))
  if (vacancy.location) params.set('location', vacancy.location)
  if (vacancy.employment_type) {
    const mapped = EMPLOYMENT_TYPE_MAP[vacancy.employment_type]
    if (mapped) params.set('jobType', mapped)
  }
  if (vacancy.application_form_token) {
    // Sets "External Apply" URL so candidates land on HRHandle's apply form
    params.set('applyType', 'EXTERNAL')
    params.set('applyUrl', `${siteUrl}/apply/${vacancy.application_form_token}`)
  }

  return `https://www.linkedin.com/hiring/jobs/create/?${params.toString()}`
}

export function LinkedInPostJobButton({ pageId, vacancy }: LinkedInPostJobButtonProps) {
  const href = buildLinkedInJobUrl(pageId, vacancy)

  return (
    <Button variant="outline" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Briefcase className="mr-2 h-4 w-4 text-[#0A66C2]" />
        Post to LinkedIn Jobs
      </a>
    </Button>
  )
}
