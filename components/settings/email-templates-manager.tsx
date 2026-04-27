'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { saveEmailTemplate, resetEmailTemplate } from '@/lib/actions/email-templates'
import { DEFAULT_TEMPLATES, type TemplateType, type EmailTemplate } from '@/lib/email-template-utils'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { RejectionTemplatesManager } from '@/components/settings/rejection-templates-manager'
import type { RejectionTemplate } from '@/lib/actions/rejection-templates'
import type { RejectionReason } from '@/lib/actions/rejection-reasons'

const TEMPLATE_META: Partial<Record<TemplateType, { label: string; description: string; variables: string[] }>> = {
  application_received: {
    label: 'Application Received',
    description: 'Sent to a candidate after they apply via the public apply link.',
    variables: ['{{candidate_name}}', '{{role}}', '{{company}}'],
  },
  interview_invitation: {
    label: 'Interview Invitation',
    description: 'Sent to a candidate when an interview is scheduled with "Send email" checked.',
    variables: ['{{candidate_name}}', '{{role}}', '{{company}}', '{{interview_date}}', '{{interview_time}}', '{{meeting_link}}'],
  },
}

const TYPES: TemplateType[] = ['application_received', 'interview_invitation']
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
  const meta = TEMPLATE_META[type]!
  const [subject, setSubject] = useState(initial.subject)
  const [body, setBody] = useState(initial.body)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

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
        <p className="text-sm text-muted-foreground">{meta.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {meta.variables.map((v) => (
            <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground font-mono">
              {v}
            </code>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Subject line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isPending}
              placeholder="Email subject..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Message body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isPending}
              rows={6}
              placeholder="Main message content..."
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This text appears as the main paragraph. The greeting, candidate name, and footer are added automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
              {saved ? 'Saved!' : 'Save'}
            </Button>
            {isModified && (
              <Button size="sm" variant="ghost" onClick={handleReset} disabled={isPending} className="text-muted-foreground">
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Reset to default
              </Button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-1.5">
          <Label>Preview</Label>
          <div className="rounded-lg border border-border bg-gray-50 p-4 text-sm space-y-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Subject:</span> {previewSubject}
            </div>
            <div className="border-t border-border pt-3 space-y-2 text-gray-700">
              <p className="font-semibold text-gray-900">
                {type === 'application_received' ? 'Thanks for Applying!' : 'Interview Invitation'}
              </p>
              <p>Dear <strong>Jane Smith</strong>,</p>
              <p>{previewBody}</p>
              {type === 'interview_invitation' && (
                <div className="rounded bg-white border border-border p-2 text-xs space-y-1">
                  <div><span className="text-gray-500">Date:</span> <strong>Monday, May 5, 2025</strong></div>
                  <div><span className="text-gray-500">Time:</span> <strong>2:00 PM</strong></div>
                  <div><span className="text-gray-500">Duration:</span> 60 minutes</div>
                  <div><span className="text-gray-500">Format:</span> Video Call</div>
                </div>
              )}
              <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">Sent via HRHandle</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EmailTemplatesManager({ initialTemplates, initialRejectionTemplates, rejectionReasons }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('application_received')

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'application_received', label: 'Application Received' },
    { id: 'interview_invitation', label: 'Interview Invitation' },
    { id: 'rejection', label: 'Rejection' },
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
