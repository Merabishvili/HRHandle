'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
        // navigator.clipboard.writeText can reject on insecure contexts
        // (non-HTTPS) or when the Permissions API has been denied.
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch (err) {
          console.error('[linkedin-post-job] clipboard write failed:', err)
          toast.error('Could not copy — please select the text manually.')
        }
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
  const applyUrl = vacancy.application_form_token
    ? `${siteUrl}/apply/${vacancy.application_form_token}`
    : null

  const [title, setTitle] = useState(vacancy.title)
  const [description, setDescription] = useState(buildFullDescription(vacancy))

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
            LinkedIn doesn&apos;t support auto-fill for free job posts. Edit the fields below if needed, then paste them into the matching step on LinkedIn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Step 1 — Job title</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Step 2 — Description</p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="text-xs break-all"
            />
            <p className="text-xs text-muted-foreground">
              LinkedIn drafts one from the title — replace it with this on the description step.
            </p>
          </div>

          {applyUrl && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Step 3 — Manage applicants</p>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono break-all">
                  {applyUrl}
                </div>
                <CopyButton text={applyUrl} />
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">On LinkedIn&apos;s &quot;Job settings&quot; step:</p>
                <ol className="list-decimal pl-4 space-y-0.5">
                  <li>Find &quot;Manage applicants&quot; and click <strong>Edit</strong></li>
                  <li>Select <strong>&quot;On an external website&quot;</strong></li>
                  <li>Paste the URL above into the <strong>Website address</strong> field</li>
                </ol>
                <p className="pt-1">This routes applicants to your HRHandle apply form instead of LinkedIn&apos;s default.</p>
              </div>
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
