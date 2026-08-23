import Link from 'next/link'
import { format } from 'date-fns'
import { getTranslations } from 'next-intl/server'
import { Sparkles, Pencil, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CustomFieldsDisplay } from '@/components/custom-fields/custom-fields-display'
import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

interface JdTabProps {
  vacancyId: string
  description: string | null
  responsibilities: string | null
  requirements: string | null
  postingDetails: {
    visibility: 'public' | 'private'
    language: string | null
    lastEditedAt: string | null
  }
  applicationFormToken: string | null
  /** Vacancy custom fields — rendered in the right rail like Posting details (#7). */
  customFieldGroups?: CustomFieldGroupWithFields[]
  customFieldValues?: CustomFieldValue[]
}

/** True when at least one custom-field value is set — keeps the JD rail's
 * "Additional information" card from rendering as an empty shell (#7). */
function hasAnyCustomFieldValue(values: CustomFieldValue[]): boolean {
  return values.some(
    (v) =>
      (v.value_text != null && v.value_text.trim() !== '') ||
      v.value_number != null ||
      v.value_boolean === true ||
      (v.value_option != null && v.value_option.trim() !== ''),
  )
}

/**
 * Wave 2.4 Job description tab per Vacancy Detail.dc.html.
 *
 * Left: a single "About the role" card hosting the published JD with two
 * actions in the header — "Improve with AI" (calm-blue trigger that
 * routes into the existing JD-suggest panel via deep link) and "Edit"
 * (links to the vacancy edit form).
 *
 * Right rail: Posting details card (visibility + language + last edited)
 * + Preview apply page card that opens the public apply form in a new
 * tab so the recruiter can sanity-check what candidates see.
 */
export async function JdTab({
  vacancyId,
  description,
  responsibilities,
  requirements,
  postingDetails,
  applicationFormToken,
  customFieldGroups = [],
  customFieldValues = [],
}: JdTabProps) {
  const t = await getTranslations()
  const hasCustomFields = customFieldGroups.some((g) => g.fields.length > 0)
  return (
    <div className="flex flex-col gap-4 bg-[oklch(0.985_0.002_247)] p-5 sm:flex-row sm:p-6">
      {/* Left — About the role */}
      <article className="flex-1 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-5 sm:p-[22px]">
        <header className="mb-4 flex flex-wrap items-center gap-2.5">
          <h2 className="text-[17px] font-bold text-foreground">{t('jdTab.aboutRole')}</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-[oklch(0.88_0.05_250)] text-[oklch(0.45_0.16_250)] hover:bg-[oklch(0.96_0.03_250)] hover:text-[oklch(0.35_0.14_250)]"
            >
              <Link href={`/vacancies/${vacancyId}/edit#ai-suggest`}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {t('jdTab.improveWithAi')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <Link href={`/vacancies/${vacancyId}/edit`}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {t('common.edit')}
              </Link>
            </Button>
          </div>
        </header>

        <div className="space-y-4 text-[13.5px] leading-[1.7] text-foreground/85">
          <JdSection heading={t('jdTab.aboutRole')} text={description} vacancyId={vacancyId} hideHeading />
          <JdSection heading={t('jdTab.whatYoullDo')} text={responsibilities} vacancyId={vacancyId} />
          <JdSection heading={t('jdTab.whatYoullBring')} text={requirements} vacancyId={vacancyId} />
        </div>
      </article>

      {/* Right rail */}
      <aside className="flex w-full shrink-0 flex-col gap-3.5 sm:w-[300px]">
        <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4" aria-label={t('jdTab.postingDetails')}>
          <h2 className="mb-3 text-[15px] font-bold text-foreground">{t('jdTab.postingDetails')}</h2>
          <ul className="flex flex-col gap-2 text-[12.5px]">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('jdTab.visibility')}</span>
              <span className="font-semibold text-foreground">
                {postingDetails.visibility === 'public' ? t('jdTab.public') : t('jdTab.private')}
              </span>
            </li>
            {postingDetails.language && (
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('jdTab.language')}</span>
                <span className="font-semibold text-foreground">{postingDetails.language}</span>
              </li>
            )}
            {postingDetails.lastEditedAt && (
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('jdTab.lastEdited')}</span>
                <span className="font-semibold text-foreground">
                  {format(new Date(postingDetails.lastEditedAt), 'MMM d, yyyy')}
                </span>
              </li>
            )}
          </ul>
        </section>

        {hasCustomFields && hasAnyCustomFieldValue(customFieldValues) && (
          <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4" aria-label={t('candidateForm.additionalInfo')}>
            <h2 className="mb-3 text-[15px] font-bold text-foreground">{t('candidateForm.additionalInfo')}</h2>
            <CustomFieldsDisplay groups={customFieldGroups} values={customFieldValues} />
          </section>
        )}

        {applicationFormToken && (
          <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4" aria-label={t('jdTab.previewApplyPage')}>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.05em] text-[oklch(0.45_0.16_250)]">
              {t('emailTpl.preview')}
            </p>
            <p className="text-[12px] leading-[1.5] text-muted-foreground">
              {t('jdTab.previewDesc')}
            </p>
            <a
              href={`/apply/${applicationFormToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[oklch(0.88_0.01_250)] px-3 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {t('jdTab.previewApplyPage')}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </section>
        )}
      </aside>
    </div>
  )
}

/**
 * One JD section. Renders the saved text, or a muted "Not added yet — Edit"
 * placeholder when the section is empty / whitespace-only — never a stray
 * character. The "About the role" section hides its heading because the card
 * header already names it.
 */
async function JdSection({
  heading,
  text,
  vacancyId,
  hideHeading,
}: {
  heading: string
  text: string | null
  vacancyId: string
  hideHeading?: boolean
}) {
  const t = await getTranslations()
  const trimmed = (text ?? '').trim()
  return (
    <section>
      {!hideHeading && (
        <h3 className="mb-1.5 text-[14px] font-bold text-foreground">{heading}</h3>
      )}
      {trimmed ? (
        <div className="whitespace-pre-wrap">{trimmed}</div>
      ) : (
        <p className="italic text-muted-foreground">
          {t('jdTab.notAdded')}{' '}
          <Link
            href={`/vacancies/${vacancyId}/edit`}
            className="font-semibold text-[oklch(0.45_0.16_250)] not-italic hover:underline"
          >
            {t('common.edit')}
          </Link>
        </p>
      )}
    </section>
  )
}
