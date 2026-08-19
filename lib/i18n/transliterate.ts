/**
 * Transliterate Georgian (Mkhedruli) and Russian/Cyrillic script to Latin.
 *
 * Purpose: non-Latin organization names must still produce a usable ASCII slug
 * for public URLs. Without this, `slugify()` (lib/onboarding.ts) strips every
 * non-Latin character and a Georgian/Russian company name collapses to an empty
 * string — or to a lone "-" if it contained a space — leaving the public vacancy
 * URL broken.
 *
 * - Georgian: National 2002 romanization scheme.
 * - Cyrillic: BGN/PCGN-style mapping.
 *
 * Collisions are acceptable for slugs (e.g. Georgian თ/ტ both → "t", ფ/ქ → "p"/"k").
 * Characters outside these two scripts are passed through unchanged (Latin,
 * digits, punctuation, spaces).
 */

// Georgian (Mkhedruli) — caseless script.
const GEORGIAN_MAP: Record<string, string> = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't',
  ი: 'i', კ: 'k', ლ: 'l', მ: 'm', ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh',
  რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q',
  შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh',
  ჯ: 'j', ჰ: 'h',
}

// Russian / Cyrillic — lowercase keys; uppercase handled by capitalizing the result.
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e',
  ю: 'yu', я: 'ya',
}

const MAP: Record<string, string> = { ...GEORGIAN_MAP, ...CYRILLIC_MAP }

export function transliterate(input: string): string {
  let out = ''
  for (const ch of input) {
    const lower = ch.toLowerCase()
    const mapped = MAP[ch] ?? MAP[lower]
    if (mapped === undefined) {
      out += ch
      continue
    }
    // Preserve capitalization for cased scripts (Cyrillic → Latin).
    if (ch !== lower && mapped.length > 0) {
      out += mapped.charAt(0).toUpperCase() + mapped.slice(1)
    } else {
      out += mapped
    }
  }
  return out
}
