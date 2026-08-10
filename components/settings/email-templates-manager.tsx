'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { saveEmailTemplate, resetEmailTemplate, setEmailTemplateEnabled } from '@/lib/actions/email-templates'
import {
  DEFAULT_TEMPLATES,
  isOptInTemplate,
  type TemplateType,
  type EmailTemplate,
} from '@/lib/email-template-utils'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { RejectionTemplatesManager } from '@/components/settings/rejection-templates-manager'
import type { RejectionTemplate } from '@/lib/actions/rejection-templates'
import type { RejectionReason } from '@/lib/actions/rejection-reasons'

// Labels/descriptions/preview headings are looked up by i18n key at render;
// variables are template tokens (locale-independent) and stay literal.
const TEMPLATE_META: Partial<Record<TemplateType, { labelKey: string; descKey: string; previewKey: string; variables: string[] }>> = {
  application_received: {
    labelKey: 'emailTpl.appReceived.label',
    descKey: 'emailTpl.appReceived.desc',
    previewKey: 'emailTpl.appReceived.preview',
    variables: ['{{candidate_name}}', '{{role}}', '{{company}}'],
  },
  interview_invitation: {
    labelKey: 'emailTpl.interviewInvitation.label',
    descKey: 'emailTpl.interviewInvitation.desc',
    previewKey: 'emailTpl.interviewInvitation.preview',
    variables: ['{{candidate_name}}', '{{role}}', '{{company}}', '{{interview_date}}', '{{interview_time}}', '{{meeting_link}}'],
  },
  status_change_screening: {
    labelKey: 'emailTpl.statusScreening.label',
    descKey: 'emailTpl.statusScreening.desc',
    previewKey: 'emailTpl.statusScreening.preview',
    variables: ['{{candidate_name}}', '{{role}}', '{{company}}', '{{status_url}}'],
  },
  status_change_interview: {
    labelKey: 'emailTpl.statusInterview.label',
    descKey: 'emailTpl.statusInterview.desc',
    previewKey: 'emailTpl.statusInterview.preview',
    variables: ['{{candidate_name}}', '{{role}}', '{{company}}', '{{status_url}}'],
  },
  offer_sent: {
    labelKey: 'emailTpl.offerSent.label',
    descKey: 'emailTpl.offerSent.desc',
    previewKey: 'emailTpl.offerSent.preview',
    variables: ['{{candidate_name}}', '{{role}}', '{{company}}', '{{offer_url}}'],
  },
}


type ActiveTab = TemplateType | 'rejection'

interface Props {
  initialTemplates: Record<TemplateType, EmailTemplate>
  initialRejectionTemplates: RejectionTemplate[]
  rejectionReasons: RejectionReason[]
}

function TemplateEditor({
  type,
  initial,
  defaults,
}: {
  type: TemplateType
  initial: EmailTemplate
  defaults: EmailTemplate
}) {
  const t = useTranslations()
  const meta = TEMPLATE_META[type]!
  const [subject, setSubject] = useState(initial.subject)
  const [body, setBody] = useState(initial.body)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isEnabled, setIsEnabled] = useState<boolean>(initial.is_enabled ?? !isOptInTemplate(type))
  const optIn = isOptInTemplate(type)

  const handleToggleEnabled = (next: boolean) => {
    setError(null)
    startTransition(async () => {
      const result = await setEmailTemplateEnabled(type, next)
      if (!result.success) { setError(result.error); return }
      setIsEnabled(next)
    })
  }

  const isModified = subject !== defaults.subject || body !== defaults.body

  const handleSave = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await saveEmailTemplate(type, subject, body)
      if (!result.success) { setError(result.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  const handleReset = () => {
    setError(null)
    startTransition(async () => {
      const result = await resetEmailTemplate(type)
      if (!result.success) { setError(result.error); return }
      setSubject(result.data.subject)
      setBody(result.data.body)
    })
  }

  const previewSubject = subject
    .replace('{{candidate_name}}', 'Jane Smith')
    .replace('{{role}}', 'Senior Developer')
    .replace('{{company}}', 'Acme Corp')

  const previewBody = body
    .replace('{{candidate_name}}', 'Jane Smith')
    .replace('{{role}}', 'Senior Developer')
    .replace('{{company}}', 'Acme Corp')
    .replace('{{interview_date}}', 'Monday, May 5, 2025')
    .replace('{{interview_time}}', '2:00 PM')
    .replace('{{meeting_link}}', 'https://meet.google.com/abc-xyz')

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{t(meta.descKey)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {meta.variables.map((v) => (
            <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground font-mono">
              {v}
            </code>
          ))}
        </div>
      </div>

      {optIn && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {isEnabled ? t('emailTpl.autoOn') : t('emailTpl.autoOff')}
            </p>
            <p className="text-xs text-muted-foreground">
              {isEnabled ? t('emailTpl.autoOnDesc') : t('emailTpl.autoOffDesc')}
            </p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggleEnabled}
            disabled={isPending}
            aria-label={t('emailTpl.enableAria')}
          />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('emailTpl.subjectLine')}</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isPending}
              maxLength={500}
              placeholder={t('emailTpl.subjectPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('emailTpl.messageBody')}</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isPending}
              maxLength={10000}
              rows={6}
              placeholder={t('emailTpl.bodyPlaceholder')}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {t('emailTpl.bodyHint')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
              {saved ? t('emailTpl.saved') : t('common.save')}
            </Button>
            {isModified && (
              <Button size="sm" variant="ghost" onClick={handleReset} disabled={isPending} className="text-muted-foreground">
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                {t('emailTpl.resetDefault')}
              </Button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-1.5">
          <Label>{t('emailTpl.preview')}</Label>
          <div className="rounded-lg border border-border bg-gray-50 p-4 text-sm space-y-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">{t('emailTpl.subjectPrefix')}</span> {previewSubject}
            </div>
            <div className="border-t border-border pt-3 space-y-2 text-gray-700">
              <p className="font-semibold text-gray-900">
                {t(meta.previewKey)}
              </p>
              <p>{t.rich('emailTpl.previewDear', { name: 'Jane Smith', b: (c) => <strong>{c}</strong> })}</p>
              <p>{previewBody}</p>
              {type === 'interview_invitation' && (
                <div className="rounded bg-white border border-border p-2 text-xs space-y-1">
                  <div><span className="text-gray-500">{t('emailTpl.pvDate')}</span> <strong>Monday, May 5, 2025</strong></div>
                  <div><span className="text-gray-500">{t('emailTpl.pvTime')}</span> <strong>2:00 PM</strong></div>
                  <div><span className="text-gray-500">{t('emailTpl.pvDuration')}</span> {t('emailTpl.pvDurationValue')}</div>
                  <div><span className="text-gray-500">{t('emailTpl.pvFormat')}</span> {t('emailTpl.pvFormatValue')}</div>
                </div>
              )}
              <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">{t('emailTpl.sentVia')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EmailTemplatesManager({ initialTemplates, initialRejectionTemplates, rejectionReasons }: Props) {
  const t = useTranslations()
  const [activeTab, setActiveTab] = useState<ActiveTab>('application_received')

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'application_received', label: t('emailTpl.appReceived.label') },
    { id: 'interview_invitation', label: t('emailTpl.interviewInvitation.label') },
    { id: 'rejection', label: t('emailTpl.tab.rejection') },
    { id: 'status_change_screening', label: t('emailTpl.statusScreening.label') },
    { id: 'status_change_interview', label: t('emailTpl.tab.statusInterview') },
    { id: 'offer_sent', label: t('emailTpl.offerSent.label') },
  ]

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                '-mb-px px-4 py-2.5 text-sm border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active template editor */}
      {activeTab === 'rejection' ? (
        <RejectionTemplatesManager
          initialTemplates={initialRejectionTemplates}
          reasons={rejectionReasons}
        />
      ) : (
        <TemplateEditor
          key={activeTab}
          type={activeTab}
          initial={initialTemplates[activeTab]}
          defaults={DEFAULT_TEMPLATES[activeTab]}
        />
      )}
    </div>
  )
}
