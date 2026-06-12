'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Smartphone, Trash2, KeyRound } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EnrollTotpDialog } from './enroll-totp-dialog'
import { unenrollFactor } from '@/lib/actions/mfa'
import { evaluatePolicy, type OrgMfaPolicy, type OrgRole } from '@/lib/mfa/policy'
import { hasVerifiedFactor, verifiedFactors, type FactorSummary } from '@/lib/mfa/factors'

interface Props {
  factors: FactorSummary[]
  role: OrgRole
  orgPolicy: OrgMfaPolicy
}

export function TwoFactorSection({ factors, role, orgPolicy }: Props) {
  const router = useRouter()
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const enrolled = hasVerifiedFactor(factors)
  const verified = verifiedFactors(factors)
  const policy = evaluatePolicy(orgPolicy, role, enrolled)

  function onRemove(factorId: string) {
    if (!confirm('Remove this authenticator? You\'ll lose 2FA on this account.')) return
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
          <Shield className="h-5 w-5" /> Two-factor authentication
        </CardTitle>
        <CardDescription>
          Add a TOTP authenticator (Google Authenticator, 1Password, Authy, etc.) to require a one-time code at sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {policy.enrollmentRequired && (
          <Alert variant="destructive">
            <AlertDescription>
              {policy.reason === 'org_wide'
                ? 'Your organization requires every member to enable 2FA. Enroll now to continue using HRHandle.'
                : 'Your organization requires owners and admins to enable 2FA. Enroll now to continue using HRHandle.'}
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
                    <p className="text-sm font-medium">{f.friendly_name ?? 'Authenticator'}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(f.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(f.id)}
                  disabled={isPending}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setEnrollOpen(true)} className="gap-2">
              <KeyRound className="h-4 w-4" />
              Add another authenticator
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-card p-6 text-center">
            <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">2FA is off</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Enroll an authenticator to add a second factor at sign-in.
            </p>
            <Button onClick={() => setEnrollOpen(true)} className="mt-4 gap-2">
              <KeyRound className="h-4 w-4" />
              Enable 2FA
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
