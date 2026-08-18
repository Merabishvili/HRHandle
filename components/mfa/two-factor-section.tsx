'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, KeyRound, Shield, Smartphone, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EnrollTotpDialog } from './enroll-totp-dialog'
import { RecoveryCodesRow } from './recovery-codes-row'
import { unenrollFactor } from '@/lib/actions/mfa'
import { evaluatePolicy, type OrgMfaPolicy, type OrgRole } from '@/lib/mfa/policy'
import { hasVerifiedFactor, verifiedFactors, type FactorSummary } from '@/lib/mfa/factors'

interface Props {
  factors: FactorSummary[]
  role: OrgRole
  orgPolicy: OrgMfaPolicy
  recoveryCodesRemaining: number
}

export function TwoFactorSection({ factors, role, orgPolicy, recoveryCodesRemaining }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const enrolled = hasVerifiedFactor(factors)
  const verified = verifiedFactors(factors)
  const policy = evaluatePolicy(orgPolicy, role, enrolled)

  function onRemove(factorId: string) {
    if (!confirm(t('mfa.removeConfirm'))) return
    startTransition(async () => {
      const res = await unenrollFactor(factorId)
      if (res.success) {
        setError(null)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" /> {t('mfa.twoFactor')}
          {enrolled && (
            <Badge
              variant="secondary"
              className="ml-auto border-transparent bg-emerald-50 text-emerald-700"
            >
              <Check className="mr-1 h-3 w-3" aria-hidden />
              {t('mfa.enabled')}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {t('mfa.sectionDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {policy.enrollmentRequired && (
          <Alert variant="destructive">
            <AlertDescription>
              {policy.reason === 'org_wide'
                ? t('mfa.requiredOrgWide')
                : t('mfa.requiredAdmins')}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {enrolled ? (
          <div className="space-y-2">
            {verified.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-md border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{f.friendly_name ?? t('mfa.authenticator')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('mfa.addedOn', { date: new Date(f.created_at).toLocaleDateString() })}
                    </p>
                  </div>
                  <Badge variant="secondary">{t('mfa.active')}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(f.id)}
                  disabled={isPending}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('mfa.remove')}
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setEnrollOpen(true)} className="gap-2">
              <KeyRound className="h-4 w-4" />
              {t('mfa.addAnother')}
            </Button>
            <RecoveryCodesRow initialRemaining={recoveryCodesRemaining} />
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-card p-6 text-center">
            <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">{t('mfa.off')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('mfa.offDesc')}
            </p>
            <Button onClick={() => setEnrollOpen(true)} className="mt-4 gap-2">
              <KeyRound className="h-4 w-4" />
              {t('mfa.enable')}
            </Button>
          </div>
        )}

        <EnrollTotpDialog
          open={enrollOpen}
          onOpenChange={setEnrollOpen}
          onEnrolled={() => router.refresh()}
        />
      </CardContent>
    </Card>
  )
}
