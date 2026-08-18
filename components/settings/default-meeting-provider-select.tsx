'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Video } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  updateDefaultMeetingProvider,
  type DefaultMeetingProvider,
} from '@/lib/actions/settings'

const AUTO = '__auto'

interface Props {
  current: DefaultMeetingProvider | null
  hasGoogle: boolean
  hasZoom: boolean
  hasTeams: boolean
}

/**
 * #6b — "Default for video interviews" selector. Only meaningful (and only
 * rendered by the page) once ≥2 meeting tools are connected. Lets the user pick
 * which auto meeting link the Schedule-Interview flow should create by default;
 * "Automatic" restores the built-in Google > Zoom > Teams precedence.
 */
export function DefaultMeetingProviderSelect({ current, hasGoogle, hasZoom, hasTeams }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [value, setValue] = useState<string>(current ?? AUTO)
  const [isPending, startTransition] = useTransition()

  const onChange = (next: string) => {
    setValue(next)
    startTransition(async () => {
      const provider = next === AUTO ? null : (next as DefaultMeetingProvider)
      const result = await updateDefaultMeetingProvider(provider)
      if (!result.success) {
        toast.error(result.error)
        setValue(current ?? AUTO)
        return
      }
      toast.success(t('meetProvider.saved'))
      router.refresh()
    })
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-muted-foreground" aria-hidden />
        <Label htmlFor="default-meeting-provider" className="text-sm font-medium">
          {t('meetProvider.title')}
        </Label>
      </div>
      <p className="mt-1 mb-3 text-sm text-muted-foreground">
        {t('meetProvider.desc')}
      </p>
      <Select value={value} onValueChange={onChange} disabled={isPending}>
        <SelectTrigger id="default-meeting-provider" className="w-full sm:w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTO}>{t('meetProvider.auto')}</SelectItem>
          {hasGoogle && <SelectItem value="google_meet">Google Meet</SelectItem>}
          {hasZoom && <SelectItem value="zoom">Zoom</SelectItem>}
          {hasTeams && <SelectItem value="teams">{t('webhooks.teams')}</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  )
}
