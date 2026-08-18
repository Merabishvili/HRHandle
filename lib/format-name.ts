/**
 * Display-time normalization for person names.
 *
 * Some candidate records arrive ALL-CAPS — CV imports, copy-paste, or
 * caps-lock on the public apply form (e.g. "ALEKSANDRE MERABISHVILI").
 * The pipeline design renders names in normal case, so this title-cases
 * tokens that are entirely uppercase ASCII while leaving everything else
 * alone:
 *
 *   - Already mixed-case names ("McDonald", "de la Cruz") are untouched —
 *     they have an intended casing we must not flatten.
 *   - Non-Latin scripts (Georgian "ალექსანდრე", Cyrillic, CJK …) and
 *     accented forms are untouched — caseless or not ours to reshape.
 *
 * Purely presentational: the stored value is never mutated, so a recruiter
 * who deliberately typed an acronym-style name still owns their data.
 */
function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) return true
  }
  return false
}

export function toDisplayName(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    // Keep the separators (runs of whitespace, hyphens) so "ANNA-MARIA"
    // and "VAN DER BERG" rejoin exactly as they were spaced.
    .split(/(\s+|-)/)
    .map((part) => {
      if (part === '' || part === '-' || /^\s+$/.test(part)) return part
      // Leave anything that already has a lowercase letter or any non-ASCII
      // character (covers Georgian, Cyrillic, accented forms, etc.).
      if (/[a-z]/.test(part) || hasNonAscii(part)) return part
      // Pure uppercase ASCII token with at least one letter → Title case.
      if (!/[A-Z]/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join('')
}

/** Convenience for the common first + last pairing. */
export function toDisplayFullName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  return `${toDisplayName(first)} ${toDisplayName(last)}`.trim()
}
