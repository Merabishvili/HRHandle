'use client'

import { Controller, type UseFormReturn } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AiJdSuggest } from '@/components/vacancies/ai-jd-suggest'
import { AiBiasCheck } from '@/components/vacancies/ai-bias-check'
import type { JdSection } from '@/lib/ai/jd-generator'
import type { VacancyFormValues } from '@/lib/validations/vacancy'
import type { Sector } from '@/lib/types'

interface DetailsSectionProps {
  form: UseFormReturn<VacancyFormValues>
  sectors: Sector[]
  disabled: boolean
}

export function DetailsSection({ form, sectors, disabled }: DetailsSectionProps) {
  const {
    control,
    register,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = form

  const description = watch('description')
  const responsibilities = watch('responsibilities')
  const requirements = watch('requirements')

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>Vacancy details</CardTitle>
        <CardDescription>Shown on the public jobs page and included when sharing on LinkedIn.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <AiJdSuggest
          getFormSnapshot={() => {
            const v = getValues()
            return {
              title: v.title,
              department: v.department || null,
              location: v.location || null,
              employment_type: v.employment_type ?? null,
              sector_name: sectors.find((s) => s.id === v.sector_id)?.name ?? null,
            }
          }}
          getExistingFieldText={(section: JdSection) => {
            const v = getValues()
            return section === 'description'
              ? v.description
              : section === 'responsibilities'
                ? v.responsibilities
                : v.requirements
          }}
          onApplyAll={(generated) => {
            if (generated.description !== undefined) {
              setValue('description', generated.description, { shouldDirty: true })
            }
            if (generated.responsibilities !== undefined) {
              setValue('responsibilities', generated.responsibilities, { shouldDirty: true })
            }
            if (generated.requirements !== undefined) {
              setValue('requirements', generated.requirements, { shouldDirty: true })
            }
          }}
        />

        <AiBiasCheck
          getFormSnapshot={() => {
            const v = getValues()
            return {
              description: v.description,
              responsibilities: v.responsibilities,
              requirements: v.requirements,
            }
          }}
        />

        <div className="space-y-2">
          <Label htmlFor="description">About the Job *</Label>
          <Textarea
            id="description"
            placeholder="Give an overview of the role — what the team does, what success looks like, and why someone would want to join..."
            disabled={disabled}
            rows={5}
            maxLength={5000}
            {...register('description')}
          />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          <p className="text-xs text-muted-foreground text-right">{(description || '').length} / 5000</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsibilities">Responsibilities</Label>
          <Textarea
            id="responsibilities"
            placeholder="• Lead backend architecture decisions&#10;• Collaborate with product and design&#10;• Mentor junior engineers..."
            disabled={disabled}
            rows={5}
            maxLength={5000}
            {...register('responsibilities')}
          />
          <p className="text-xs text-muted-foreground text-right">{(responsibilities || '').length} / 5000</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="requirements">Requirements</Label>
          <Textarea
            id="requirements"
            placeholder="• 5+ years of experience with TypeScript&#10;• Strong understanding of distributed systems&#10;• Experience with cloud infrastructure..."
            disabled={disabled}
            rows={5}
            maxLength={5000}
            {...register('requirements')}
          />
          <p className="text-xs text-muted-foreground text-right">{(requirements || '').length} / 5000</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="show_on_public_page" className="text-sm font-medium">Show on public jobs page</Label>
            <p className="text-xs text-muted-foreground">Candidates can discover and apply to this vacancy from your public jobs page.</p>
          </div>
          <Controller
            control={control}
            name="show_on_public_page"
            render={({ field }) => (
              <Switch
                id="show_on_public_page"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
