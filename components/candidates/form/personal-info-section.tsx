'use client'

import { Controller, type UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { Linkedin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CandidateFormValues } from '@/lib/validations/candidate'

interface PersonalInfoSectionProps {
  form: UseFormReturn<CandidateFormValues>
  disabled: boolean
}

export function PersonalInfoSection({ form, disabled }: PersonalInfoSectionProps) {
  const t = useTranslations()
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = form

  const linkedin = watch('linkedin_profile_url')

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>{t('candidateForm.personalInfo')}</CardTitle>
        <CardDescription>{t('candidateForm.personalInfoDesc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first_name">{t('candWizard.personal.firstName')} *</Label>
            <Input id="first_name" placeholder={t('candidateForm.phFirstName')} disabled={disabled} {...register('first_name')} />
            {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">{t('candWizard.personal.lastName')} *</Label>
            <Input id="last_name" placeholder={t('candidateForm.phLastName')} disabled={disabled} {...register('last_name')} />
            {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">{t('candWizard.personal.email')}</Label>
            <Input id="email" type="email" placeholder="john@example.com" disabled={disabled} {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('candWizard.personal.phone')}</Label>
            <Input id="phone" type="tel" placeholder="+1 555 123 4567" disabled={disabled} {...register('phone')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="location">{t('candWizard.personal.location')}</Label>
            <Input id="location" placeholder={t('candWizard.personal.phLocation')} disabled={disabled} {...register('location')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">{t('candWizard.personal.timezone')}</Label>
            <Input id="timezone" placeholder={t('candWizard.personal.phTimezone')} disabled={disabled} {...register('timezone')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="salary_expectation">{t('candWizard.personal.salaryExpectation')}</Label>
            <Input
              id="salary_expectation"
              placeholder={t('candidateForm.phSalary2')}
              disabled={disabled}
              {...register('salary_expectation')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice_period">{t('candWizard.personal.noticePeriod')}</Label>
            <Input id="notice_period" placeholder={t('candWizard.personal.phNotice')} disabled={disabled} {...register('notice_period')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="languages">{t('candWizard.personal.languages')}</Label>
          <Controller
            control={control}
            name="languages"
            render={({ field }) => (
              <Input
                id="languages"
                placeholder={t('candWizard.personal.phLanguages')}
                value={(field.value ?? []).join(', ')}
                onChange={(e) =>
                  field.onChange(
                    e.target.value ? e.target.value.split(',').map((l) => l.trim()).filter(Boolean) : [],
                  )
                }
                onBlur={field.onBlur}
                disabled={disabled}
              />
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="linkedin_profile_url">{t('candidateForm.linkedinProfile')}</Label>
            <div className="flex gap-2">
              <Input
                id="linkedin_profile_url"
                type="url"
                placeholder="https://linkedin.com/in/johnsmith"
                disabled={disabled}
                {...register('linkedin_profile_url')}
              />
              {linkedin && (
                <a
                  href={/^https?:\/\//i.test(linkedin) ? linkedin : `https://${linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button type="button" variant="outline" size="icon" title={t('candidateForm.openLinkedin')} aria-label={t('candidateForm.openLinkedin')}>
                    <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                  </Button>
                </a>
              )}
            </div>
            {errors.linkedin_profile_url && (
              <p className="text-xs text-destructive">{errors.linkedin_profile_url.message}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
