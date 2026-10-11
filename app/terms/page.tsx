import { LegalDocPage, legalMetadata } from '@/components/legal/legal-page'

// Content lives in components/legal/content/terms-{en,ka,ru}.tsx — shown in the
// visitor's language (NEXT_LOCALE cookie) with a language switcher.
export const generateMetadata = () => legalMetadata('terms')

export default function TermsPage() {
  return <LegalDocPage doc="terms" />
}
