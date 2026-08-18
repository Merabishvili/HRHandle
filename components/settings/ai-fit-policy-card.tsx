'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { setAiFitEnabled } from '@/lib/actions/ai-fit'

interface Props {
  initial: {
    ai_fit_enabled: boolean
  }
}

/**
 * Owner-only opt-in for AI Fit Analysis (Wave 3.1). Default OFF. Enabling
 * requires ticking an explicit acknowledgement of how the feature is used
 * (advisory-only, evidence-based, human-decides) — this is Guardrail 2 and also
 * satisfies the EU AI Act acknowledgement. Disabling is one click.
 */
export function AiFitPolicyCard({ initial }: Props) {
  const router = useRouter()
  const t = useTranslations()
  const [enabled, setEnabled] = useState(initial.ai_fit_enabled)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // We're enabling from an off state → require the acknowledgement tick.
  const turningOn = enabled && !initial.ai_fit_enabled
  const dirty = enabled !== initial.ai_fit_enabled
  const canSave = dirty && (!turningOn || acknowledged)

  function onSave() {
    startTransition(async () => {
      const res = await setAiFitEnabled(enabled, acknowledged)
      if (res.success) {
        setError(null)
        setNotice(enabled ? t('settings.aiFit.onNotice') : t('settings.aiFit.offNotice'))
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
          <Sparkles className="h-5 w-5" />
          {t('settings.aiFit.title')}
        </CardTitle>
        <CardDescription>
          {t('settings.aiFit.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <input
            id="ai-fit-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked)
              if (!e.target.checked) setAcknowledged(false)
            }}
            className="mt-1 h-4 w-4"
            aria-label={t('settings.aiFit.enable')}
          />
          <label htmlFor="ai-fit-enabled" className="cursor-pointer">
            <span className="block text-sm font-medium">{t('settings.aiFit.enable')}</span>
            <span className="block text-xs text-muted-foreground">
              {t('settings.aiFit.enableHelp')}
            </span>
          </label>
        </div>

        {turningOn && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <label htmlFor="ai-fit-ack" className="flex cursor-pointer items-start gap-3">
              <input
                id="ai-fit-ack"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span className="text-xs text-muted-foreground">
                {t('settings.aiFit.acknowledgement')}
              </span>
            </label>
          </div>
        )}

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

        <Button onClick={onSave} disabled={isPending || !canSave}>
          {isPending ? t('common.saving') : enabled ? t('common.enable') : t('common.disable')}
        </Button>
      </CardContent>
    </Card>
  )
}
