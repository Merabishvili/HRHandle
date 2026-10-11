import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

/**
 * "Link no longer valid" page for the public token/slug pages (status, offer,
 * shared assessment, apply, jobs). The link didn't resolve, so there's no
 * organization to take a language from — it follows the visitor's language.
 */
export async function LinkNotFound({
  titleKey = 'publicLink.notFoundTitle',
  bodyKey,
}: {
  titleKey?: string
  bodyKey: string
}) {
  const t = await getTranslations()
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-bold text-gray-900">{t(titleKey)}</h1>
      <p className="mt-3 text-sm text-gray-600">{t(bodyKey)}</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
      >
        {t('publicLink.goHome')}
      </Link>
    </main>
  )
}
