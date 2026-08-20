'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Globe } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setOrgContentLocale } from '@/lib/actions/settings'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/locales'

interface Props {
  initial: { locale: Locale }
}

/**
 * Org content-language card. Owner/admin only. A single dropdown over all app
 * locales: the chosen language is the one language every candidate-facing page
 * (public jobs/apply/status/offer), outgoing email, and AI output is rendered
 * in. There is no multi-language public surface — see docs/redesign/i18n-plan.md §10.
 */
export function OrgLanguageCard({ initial }: Props) {
  const router = useRouter()
  const t = useTranslations()
  const [locale, setLocale] = useState<Locale>(initial.locale)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const dirty = locale !== initial.locale

  const onSave = () => {
    startTransition(async () => {
      const res = await setOrgContentLocale(locale)
      if (res.success) {
        setError(null)
        setNotice(t('settings.orgLang.saved'))
        router.refresh()
      } else {
        setError(res.error)
        setNotice(null)
      }
    })
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t('settings.orgLang.title')}
        </CardTitle>
        <CardDescription>{t('settings.orgLang.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('settings.orgLang.defaultLabel')}</p>
          <Select value={locale} onValueChange={(v) => setLocale(v as Locale)} disabled={isPending}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l} value={l}>{LOCALE_LABELS[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <Button onClick={onSave} disabled={isPending || !dirty}>
          {isPending ? t('common.saving') : t('common.save')}
        </Button>
      </CardContent>
    </Card>
  )
}
