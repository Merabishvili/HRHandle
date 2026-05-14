import { MapPin, Briefcase, DollarSign, Clock, Globe } from 'lucide-react'

interface SummaryStripProps {
  location: string | null
  timezone: string | null
  languages: string[]
  salaryExpectation: string | null
  noticePeriod: string | null
  yearsExperience: number | null
}

export function SummaryStrip({
  location,
  timezone,
  languages,
  salaryExpectation,
  noticePeriod,
  yearsExperience,
}: SummaryStripProps) {
  const locationLabel = [location, timezone].filter(Boolean).join(' · ') || null
  const langLabel = languages.length > 0 ? languages.join(', ') : null
  const expLabel = yearsExperience != null ? `${yearsExperience}+ years experience` : null

  const items = [
    { icon: MapPin,       value: locationLabel },
    { icon: Briefcase,    value: expLabel },
    { icon: DollarSign,   value: salaryExpectation },
    { icon: Clock,        value: noticePeriod ? `${noticePeriod} notice` : null },
    { icon: Globe,        value: langLabel },
  ].filter((item) => item.value !== null)

  if (items.length === 0) return null

  return (
    <div className="mb-5 rounded-xl border border-border bg-card px-5 py-3.5">
      <div className="flex flex-wrap gap-x-7 gap-y-2">
        {items.map(({ icon: Icon, value }, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Icon className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
            {value}
          </span>
        ))}
      </div>
    </div>
  )
}
