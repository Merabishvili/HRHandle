import Link from 'next/link'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { VacancyStatusSelect } from '@/components/vacancies/vacancy-status-select'
import { DeleteVacancyButton } from '@/components/vacancies/delete-vacancy-button'
import {
  PipelineStagesManager,
  type PipelineStageRow,
} from '@/components/vacancies/pipeline-stages-manager'

interface SettingsTabProps {
  vacancyId: string
  vacancyTitle: string
  roleDetails: {
    title: string
    department: string | null
    location: string | null
    employmentTypeLabel: string
    endDate: string | null
  }
  status: {
    current: { id: string; name: string; code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived' }
    available: { id: string; name: string; code: 'draft' | 'open' | 'on_hold' | 'closed' | 'archived' }[]
  }
  /** Per-vacancy `pipeline_stages` rows in sort order. Wave 2.6 Slice 3
   * makes these editable via PipelineStagesManager. */
  stages: PipelineStageRow[]
  /** Whether the current user can manage this vacancy's stages. Mirrors
   * the org-admin role gate enforced by the server actions. */
  canEditStages: boolean
}

/**
 * Wave 2.4 Settings tab per Vacancy Detail.dc.html.
 *
 * Two-column grid (Role details left / Status & visibility + Pipeline
 * stages right) + a danger-zone card spanning the full width. Stage
 * customization is currently read-only — the "Add stage" pill links to
 * the (deferred) Wave 2.6 stage manager.
 */
export function SettingsTab({
  vacancyId,
  vacancyTitle,
  roleDetails,
  status,
  stages,
  canEditStages,
}: SettingsTabProps) {
  return (
    <div className="grid gap-4 bg-[oklch(0.985_0.002_247)] p-5 sm:p-6 lg:grid-cols-2">
      {/* Vacancy details */}
      <section
        className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]"
        aria-label="Vacancy details"
      >
        <h2 className="mb-3.5 text-[15px] font-bold text-foreground">Vacancy details</h2>
        <div className="flex flex-col gap-2.5 text-[13px]">
          <SettingsField label="Title" value={roleDetails.title} />
          <div className="flex gap-2.5">
            <SettingsField label="Department" value={roleDetails.department ?? '—'} />
            <SettingsField label="Location" value={roleDetails.location ?? '—'} />
          </div>
          <div className="flex gap-2.5">
            <SettingsField label="Type" value={roleDetails.employmentTypeLabel} />
            <SettingsField
              label="End date"
              value={roleDetails.endDate ? format(new Date(roleDetails.endDate), 'MMM d, yyyy') : '—'}
            />
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="mt-3.5 gap-1.5">
          <Link href={`/vacancies/${vacancyId}/edit`}>Edit role details</Link>
        </Button>
      </section>

      {/* Status & visibility + Pipeline stages */}
      <div className="flex flex-col gap-4">
        <section
          className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]"
          aria-label="Status & visibility"
        >
          <h2 className="mb-3 text-[15px] font-bold text-foreground">Status &amp; visibility</h2>
          <VacancyStatusSelect
            vacancyId={vacancyId}
            current={status.current}
            options={status.available}
          />
          <p className="mt-2.5 text-[12px] text-muted-foreground">
            Closing stops new applications without deleting the role.
          </p>
        </section>

        <section
          className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]"
          aria-label="Pipeline stages"
        >
          <h2 className="mb-3 text-[15px] font-bold text-foreground">Pipeline stages</h2>
          <PipelineStagesManager
            vacancyId={vacancyId}
            initialStages={stages}
            canEdit={canEditStages}
          />
        </section>
      </div>

      {/* Danger zone — full width */}
      <section
        className="rounded-xl border bg-[oklch(0.995_0.01_20)] p-4 lg:col-span-2"
        style={{ borderColor: 'oklch(0.85 0.06 27)' }}
        aria-label="Danger zone"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <p className="text-[13.5px] font-bold text-[oklch(0.5_0.19_27)]">Danger zone</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Closing stops new applications. Deleting removes the role and its candidates — this can&apos;t be undone.
            </p>
          </div>
          <DeleteVacancyButton vacancyId={vacancyId} vacancyTitle={vacancyTitle} />
        </div>
      </section>
    </div>
  )
}

function SettingsField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1">
      <p className="mb-1 text-[11.5px] text-muted-foreground">{label}</p>
      <div className="rounded-md border border-[oklch(0.9_0.01_250)] bg-white px-3 py-2 text-[13px] text-foreground">
        {value}
      </div>
    </div>
  )
}
