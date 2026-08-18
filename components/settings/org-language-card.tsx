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
import { setOrgContentLocales } from '@/lib/actions/settings'
import { LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'

interface Props {
  initial: { default: Locale; enabled: Locale[] }
}

/**
 * Org content-language card (i18n Slice 2, design Screen 2). Owner/admin only.
 * A **default** single-select (over the enabled set) + an **also-available**
 * checklist over all app locales. English is always enabled (locked); disabling
 * the current default resets the default to English.
 */
export function OrgLanguageCard({ initial }: Props) {
  const router = useRouter()
  const t = useTranslations()
  const [def, setDef] = useState<Locale>(initial.default)
  const [enabled, setEnabled] = useState<Locale[]>(initial.enabled)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const toggle = (locale: Locale, on: boolean) => {
    const set = new Set(enabled)
    if (on) set.add(locale)
    else set.delete(locale)
    set.add(DEFAULT_LOCALE) // en can't be disabled
    const next = LOCALES.filter((l) => set.has(l))
    setEnabled(next)
    if (!next.includes(def)) setDef(DEFAULT_LOCALE) // disabled the default → reset
  }

  const dirty = def !== initial.default || enabled.join(',') !== initial.enabled.join(',')

  const onSave = () => {
    startTransition(async () => {
      const res = await setOrgContentLocales(def, enabled)
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
          <Select value={def} onValueChange={(v) => setDef(v as Locale)} disabled={isPending}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.filter((l) => enabled.includes(l)).map((l) => (
                <SelectItem key={l} value={l}>{LOCALE_LABELS[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('settings.orgLang.alsoAvailable')}</p>
          <div className="flex flex-col gap-2">
            {LOCALES.map((locale) => {
              const checked = enabled.includes(locale)
              const locked = locale === DEFAULT_LOCALE
              return (
                <label
                  key={locale}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked || isPending}
                    onChange={(e) => toggle(locale, e.target.checked)}
                    className="h-4 w-4"
                    aria-label={LOCALE_LABELS[locale]}
                  />
                  <span className="flex-1">{LOCALE_LABELS[locale]}</span>
                  {locale === def && (
                    <span className="text-xs text-muted-foreground">{t('settings.orgLang.defaultTag')}</span>
                  )}
                </label>
              )
            })}
          </div>
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
