'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Briefcase, Copy, Check, ExternalLink } from 'lucide-react'

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

function buildFullDescription(vacancy: VacancyData): string {
  const parts: string[] = [vacancy.description.trim()]
  if (vacancy.responsibilities?.trim()) {
    parts.push(`\n\nResponsibilities\n${vacancy.responsibilities.trim()}`)
  }
  if (vacancy.requirements?.trim()) {
    parts.push(`\n\nRequirements\n${vacancy.requirements.trim()}`)
  }
  return parts.join('')
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? (
        <>
          <Check className="mr-1 h-3.5 w-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Copy
        </>
      )}
    </Button>
  )
}

export function LinkedInPostJobButton({ pageId, vacancy }: LinkedInPostJobButtonProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hrhandle.com'
  const linkedInUrl = `https://www.linkedin.com/job-posting/v2/?companyId=${pageId}`
  const fullDescription = buildFullDescription(vacancy)
  const applyUrl = vacancy.application_form_token
    ? `${siteUrl}/apply/${vacancy.application_form_token}`
    : null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Briefcase className="mr-2 h-4 w-4 text-[#0A66C2]" />
          Post to LinkedIn Jobs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Post to LinkedIn Jobs</DialogTitle>
          <DialogDescription>
            LinkedIn doesn&apos;t support auto-fill for free job posts. Copy each field below and paste it into the matching step on LinkedIn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Step 1 — Job title</p>
              <CopyButton text={vacancy.title} />
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              {vacancy.title}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Step 2 — Description</p>
              <CopyButton text={fullDescription} />
            </div>
            <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-xs whitespace-pre-wrap">
              {fullDescription}
            </div>
            <p className="text-xs text-muted-foreground">
              LinkedIn drafts one from the title — replace it with this on the description step.
            </p>
          </div>

          {applyUrl && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Step 3 — External apply URL</p>
                <CopyButton text={applyUrl} />
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono break-all">
                {applyUrl}
              </div>
              <p className="text-xs text-muted-foreground">
                On the &quot;Job settings&quot; step, choose &quot;On an external website&quot; and paste this URL so applicants land on your HRHandle form.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button asChild>
            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open LinkedIn Job Posting
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
