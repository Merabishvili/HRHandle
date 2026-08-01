'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { setOrgMfaPolicy } from '@/lib/actions/mfa'

interface Props {
  initial: {
    require_mfa: boolean
    require_mfa_for_admins: boolean
  }
}

export function MfaPolicyCard({ initial }: Props) {
  const router = useRouter()
  const t = useTranslations()
  const [requireAll, setRequireAll] = useState(initial.require_mfa)
  const [requireAdmins, setRequireAdmins] = useState(initial.require_mfa_for_admins)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSave() {
    startTransition(async () => {
      const res = await setOrgMfaPolicy({
        require_mfa: requireAll,
        require_mfa_for_admins: requireAdmins,
      })
      if (res.success) {
        setError(null)
        setNotice(t('settings.mfa.saved'))
        router.refresh()
      } else {
        setError(res.error)
        setNotice(null)
      }
    })
  }

  const dirty =
    requireAll !== initial.require_mfa || requireAdmins !== initial.require_mfa_for_admins

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('settings.mfa.title')}
        </CardTitle>
        <CardDescription>
          {t('settings.mfa.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <input
            id="mfa-policy-require-all"
            type="checkbox"
            checked={requireAll}
            onChange={(e) => {
              setRequireAll(e.target.checked)
              if (e.target.checked) setRequireAdmins(true)
            }}
            className="mt-1 h-4 w-4"
            aria-label={t('settings.mfa.requireAll')}
          />
          <label htmlFor="mfa-policy-require-all" className="cursor-pointer">
            <span className="block text-sm font-medium">{t('settings.mfa.requireAll')}</span>
            <span className="block text-xs text-muted-foreground">
              {t('settings.mfa.requireAllHelp')}
            </span>
          </label>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="mfa-policy-require-admins"
            type="checkbox"
            checked={requireAdmins || requireAll}
            disabled={requireAll}
            onChange={(e) => setRequireAdmins(e.target.checked)}
            className="mt-1 h-4 w-4"
            aria-label={t('settings.mfa.requireAdmins')}
          />
          <label htmlFor="mfa-policy-require-admins" className="cursor-pointer">
            <span className="block text-sm font-medium">{t('settings.mfa.requireAdmins')}</span>
            <span className="block text-xs text-muted-foreground">
              {t('settings.mfa.requireAdminsHelp')}
            </span>
          </label>
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
          {isPending ? t('common.saving') : t('settings.mfa.savePolicy')}
        </Button>
      </CardContent>
    </Card>
  )
}
