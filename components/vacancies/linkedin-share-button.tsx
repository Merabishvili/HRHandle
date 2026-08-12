import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Linkedin } from 'lucide-react'

interface LinkedInShareButtonProps {
  title: string
  location: string | null
  employmentType: string | null
  department: string | null
  description?: string | null
  responsibilities?: string | null
  requirements?: string | null
}

function formatEmploymentType(value: string | null): string {
  if (!value) return ''
  const map: Record<string, string> = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract: 'Contract',
    internship: 'Internship',
  }
  return map[value] || value
}

function buildShareUrl(props: LinkedInShareButtonProps): string {
  const { title, location, employmentType, department, description, responsibilities, requirements } = props
  const lines: string[] = []

  lines.push(`🚀 We're hiring: ${title}`)
  if (department) lines.push(`📂 ${department}`)
  if (location) lines.push(`📍 ${location}`)
  const formattedType = formatEmploymentType(employmentType)
  if (formattedType) lines.push(`💼 ${formattedType}`)

  if (description?.trim()) {
    lines.push('')
    lines.push('📌 About the Job')
    lines.push(description.trim())
  }

  if (responsibilities?.trim()) {
    lines.push('')
    lines.push('🎯 Responsibilities')
    lines.push(responsibilities.trim())
  }

  if (requirements?.trim()) {
    lines.push('')
    lines.push('✅ Requirements')
    lines.push(requirements.trim())
  }

  lines.push('')
  lines.push('Interested? Get in touch or apply via the link in our profile.')
  lines.push('')
  lines.push('#hiring #jobs #recruitment')

  const raw = lines.join('\n')
  const text = encodeURIComponent(raw.length > 2800 ? raw.slice(0, 2800) + '…' : raw)
  return `https://www.linkedin.com/feed/?shareActive=true&text=${text}`
}

export async function LinkedInShareButton(props: LinkedInShareButtonProps) {
  const t = await getTranslations()
  const href = buildShareUrl(props)

  return (
    <Button variant="outline" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Linkedin className="mr-2 h-4 w-4 text-[#0A66C2]" />
        {t('liShare.button')}
      </a>
    </Button>
  )
}
