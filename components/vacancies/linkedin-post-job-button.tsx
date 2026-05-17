import { Button } from '@/components/ui/button'
import { Briefcase } from 'lucide-react'

interface LinkedInPostJobButtonProps {
  pageId: string
}

export function LinkedInPostJobButton({ pageId }: LinkedInPostJobButtonProps) {
  return (
    <Button variant="outline" asChild>
      <a
        href={`https://www.linkedin.com/hiring/jobs/create/?companyId=${pageId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Briefcase className="mr-2 h-4 w-4 text-[#0A66C2]" />
        Post to LinkedIn Jobs
      </a>
    </Button>
  )
}
