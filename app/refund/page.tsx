import { LegalDocPage, legalMetadata } from '@/components/legal/legal-page'

// Content lives in components/legal/content/refund-{en,ka,ru}.tsx — shown in the
// visitor's language (NEXT_LOCALE cookie) with a language switcher.
export const generateMetadata = () => legalMetadata('refund')

export default function RefundPage() {
  return <LegalDocPage doc="refund" />
}
