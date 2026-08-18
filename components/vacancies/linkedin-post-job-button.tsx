'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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

function buildFullDescription(vacancy: VacancyData, labels: { responsibilities: string; requirements: string }): string {
  const parts: string[] = [vacancy.description.trim()]
  if (vacancy.responsibilities?.trim()) {
    parts.push(`\n\n${labels.responsibilities}\n${vacancy.responsibilities.trim()}`)
  }
  if (vacancy.requirements?.trim()) {
    parts.push(`\n\n${labels.requirements}\n${vacancy.requirements.trim()}`)
  }
  return parts.join('')
}

function CopyButton({ text }: { text: string }) {
  const t = useTranslations()
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
          toast.error(t('liPost.copyFailed'))
        }
      }}
    >
      {copied ? (
        <>
          <Check className="mr-1 h-3.5 w-3.5" />
          {t('offer.copied')}
        </>
      ) : (
        <>
          <Copy className="mr-1 h-3.5 w-3.5" />
          {t('aiJd.copy')}
        </>
      )}
    </Button>
  )
}

export function LinkedInPostJobButton({ pageId, vacancy }: LinkedInPostJobButtonProps) {
  const t = useTranslations()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hrhandle.com'
  const linkedInUrl = `https://www.linkedin.com/job-posting/v2/?companyId=${pageId}`
  const applyUrl = vacancy.application_form_token
    ? `${siteUrl}/apply/${vacancy.application_form_token}`
    : null

  const [title, setTitle] = useState(vacancy.title)
  const [description, setDescription] = useState(
    buildFullDescription(vacancy, { responsibilities: t('apply.responsibilities'), requirements: t('apply.requirements') }),
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Briefcase className="mr-2 h-4 w-4 text-[#0A66C2]" />
          {t('liPost.postToLinkedIn')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('liPost.postToLinkedIn')}</DialogTitle>
          <DialogDescription>
            {t('liPost.desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('liPost.step1')}</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('liPost.step2')}</p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="text-xs break-all"
            />
            <p className="text-xs text-muted-foreground">
              {t('liPost.step2Hint')}
            </p>
          </div>

          {applyUrl && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t('liPost.step3')}</p>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono break-all">
                  {applyUrl}
                </div>
                <CopyButton text={applyUrl} />
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">{t('liPost.jobSettingsStep')}</p>
                <ol className="list-decimal pl-4 space-y-0.5">
                  <li>{t.rich('liPost.li1', { b: (c) => <strong>{c}</strong> })}</li>
                  <li>{t.rich('liPost.li2', { b: (c) => <strong>{c}</strong> })}</li>
                  <li>{t.rich('liPost.li3', { b: (c) => <strong>{c}</strong> })}</li>
                </ol>
                <p className="pt-1">{t('liPost.routesHint')}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button asChild>
            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('liPost.openPosting')}
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
