'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
        setNotice('Policy saved. Members will be prompted to enroll on their next page load.')
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
          Two-factor authentication policy
        </CardTitle>
        <CardDescription>
          Require members of your organisation to enroll a TOTP authenticator. Only the owner can change this policy.
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
            aria-label="Require 2FA for everyone"
          />
          <label htmlFor="mfa-policy-require-all" className="cursor-pointer">
            <span className="block text-sm font-medium">Require 2FA for everyone</span>
            <span className="block text-xs text-muted-foreground">
              Every member, including owners and admins, must enroll before they can use HRHandle.
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
            aria-label="Require 2FA for owners and admins only"
          />
          <label htmlFor="mfa-policy-require-admins" className="cursor-pointer">
            <span className="block text-sm font-medium">Require 2FA for owners and admins only</span>
            <span className="block text-xs text-muted-foreground">
              The two roles that can invite members, delete data, and manage billing. Members are unaffected.
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
          {isPending ? 'Saving…' : 'Save policy'}
        </Button>
      </CardContent>
    </Card>
  )
}
