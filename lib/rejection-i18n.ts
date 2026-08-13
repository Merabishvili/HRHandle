/**
 * The default rejection reason + its paired template are seeded at onboarding
 * with the English name "General" (see `lib/onboarding.ts`). Localize that
 * seeded default while leaving any custom reason/template name as typed.
 */
export function rejectionReasonLabel(t: (key: string) => string, name: string): string {
  return name.trim().toLowerCase() === 'general' ? t('rejectReason.general') : name
}
