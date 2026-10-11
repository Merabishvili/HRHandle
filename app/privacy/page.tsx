import { LegalDocPage, legalMetadata } from '@/components/legal/legal-page'

// Content lives in components/legal/content/privacy-{en,ka,ru}.tsx — shown in the
// visitor's language (NEXT_LOCALE cookie) with a language switcher.
export const generateMetadata = () => legalMetadata('privacy')

export default function PrivacyPage() {
  return <LegalDocPage doc="privacy" />
}
