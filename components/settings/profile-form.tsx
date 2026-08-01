'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { updateProfile } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle } from 'lucide-react'
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n/locales'
import type { Profile } from '@/lib/types'

const NO_LANGUAGE = '__default'
// Only the locales we actually ship message catalogs for. Others return when
// their catalog is reviewed + shipped (docs/redesign/i18n-plan.md §2.2).
const LANGUAGES = LOCALES.map((value) => ({ value, label: LOCALE_LABELS[value] }))

interface ProfileFormProps {
  profile: Profile
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter()
  const t = useTranslations()
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [language, setLanguage] = useState(profile.language || NO_LANGUAGE)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsLoading(true)

    const result = await updateProfile({
      full_name: fullName,
      phone: phone || null,
      language: language === NO_LANGUAGE ? null : language,
    })

    if (!result.success) {
      setError(result.error)
    } else {
      setSuccess(true)
      router.refresh()
    }

    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{t('settings.profile.updated')}</AlertDescription>
        </Alert>
      )}

      {/* Email is shown read-only in the "Account" card below — no need to
          repeat it as a disabled input here. */}
      <div className="space-y-2">
        <Label htmlFor="fullName">{t('settings.profile.fullName')}</Label>
        <Input
          id="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t('settings.profile.fullNamePlaceholder')}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">{t('columns.phone')}</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 123 4567"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="language">{t('settings.profile.language')}</Label>
        <Select value={language} onValueChange={setLanguage} disabled={isLoading}>
          <SelectTrigger id="language" className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_LANGUAGE}>{t('settings.profile.systemDefault')}</SelectItem>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t('settings.profile.languageHelp')}
        </p>
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('common.saving')}</> : t('common.saveChanges')}
      </Button>
    </form>
  )
}
