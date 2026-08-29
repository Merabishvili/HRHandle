import { getTranslations } from 'next-intl/server'

import { SupportForm } from '@/components/support/support-form'

/**
 * Settings → Support. The settings layout already gates auth + renders the nav;
 * this page just hosts the in-app support form (email + org are derived from
 * the session server-side, so no email field or captcha here).
 */
export default async function SupportSettingsPage() {
  const t = await getTranslations()
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">{t('support.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('support.subtitle')}</p>
      </div>
      <SupportForm />
    </div>
  )
}
