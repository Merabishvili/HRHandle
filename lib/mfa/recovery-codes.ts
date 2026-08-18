/**
 * A-8b — Recovery-code generation + hashing helpers.
 *
 * Raw codes are generated server-side, hashed (sha256-hex), persisted
 * as hashes only, and returned to the client ONCE for a reveal-once
 * modal. The raw form is never stored.
 */

import { createHash, randomBytes } from 'node:crypto'

export const RECOVERY_CODE_COUNT = 10
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // skip 0/1/I/O for legibility
const GROUP_SIZE = 5

/**
 * Generates a single human-readable recovery code in the form
 * `XXXXX-XXXXX` using a 32-char ambiguity-free alphabet. ~50 bits of
 * entropy — fine for a single-use second-factor fallback when the
 * codes set is finite (10).
 */
function generateOne(): string {
  const bytes = randomBytes(GROUP_SIZE * 2)
  let out = ''
  for (let i = 0; i < GROUP_SIZE * 2; i++) {
    const byte = bytes[i] ?? 0
    out += ALPHABET[byte % ALPHABET.length]
    if (i === GROUP_SIZE - 1) out += '-'
  }
  return out
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>()
  while (codes.size < count) codes.add(generateOne())
  return Array.from(codes)
}

export function hashRecoveryCode(code: string): string {
  // Normalize so the user can type 'abc-def' or 'ABC DEF' and still
  // match — strip non-alphanumerics, uppercase. Matches what the
  // consumer path (deferred) will do at challenge time.
  const normalized = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return createHash('sha256').update(normalized).digest('hex')
}
