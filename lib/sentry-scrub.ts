import type { ErrorEvent, Event } from '@sentry/nextjs'

const REDACT = '[REDACTED]'

// Field names whose values should never leave the process. Matched case-insensitively
// against a substring of the key name (so `candidate_email`, `application_body`, etc. are caught).
const PII_KEY_PATTERNS = [
  'email',
  'phone',
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  // candidate / application / note bodies and free-text fields
  'first_name',
  'last_name',
  'full_name',
  'linkedin',
  'salary',
  'notice_period',
  'cover_letter',
  'note',
  'description',
  'address',
  'date_of_birth',
]

function shouldRedactKey(key: string): boolean {
  const lower = key.toLowerCase()
  return PII_KEY_PATTERNS.some((p) => lower.includes(p))
}

// Recursively walk an unknown structure, redacting values under PII-matching keys.
// Bounded depth to avoid pathological cycles in event data.
function redactInPlace(value: unknown, depth = 0): unknown {
  if (depth > 8 || value == null) return value
  if (Array.isArray(value)) {
    return value.map((item) => redactInPlace(item, depth + 1))
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (shouldRedactKey(k)) {
        out[k] = REDACT
      } else {
        out[k] = redactInPlace(v, depth + 1)
      }
    }
    return out
  }
  return value
}

/**
 * Sentry `beforeSend` hook — scrubs PII from candidate/application/note/email
 * fields before any event leaves the process. Safe to use from `client`,
 * `server`, and `edge` runtimes.
 *
 * Returning `null` would drop the event entirely; we always return a (modified)
 * event so we keep observability of *what* failed without leaking *whose data*.
 */
export function scrubPii<T extends ErrorEvent | Event>(event: T): T {
  // Drop the user identifier email/IP/username if present
  if (event.user) {
    const { email, username, ip_address: _ip, ...restUser } = event.user
    event.user = {
      ...restUser,
      ...(email ? { email: REDACT } : {}),
      ...(username ? { username: REDACT } : {}),
      // ip_address is always dropped (never re-added)
    }
  }

  // Redact request payload + headers (cookies, auth)
  if (event.request) {
    if (event.request.headers && typeof event.request.headers === 'object') {
      const headers = event.request.headers as Record<string, string>
      const cleanHeaders: Record<string, string> = {}
      for (const [k, v] of Object.entries(headers)) {
        cleanHeaders[k] = shouldRedactKey(k) ? REDACT : v
      }
      event.request.headers = cleanHeaders
    }
    if (event.request.data) {
      event.request.data = redactInPlace(event.request.data) as typeof event.request.data
    }
    if (event.request.cookies) {
      event.request.cookies = REDACT as unknown as typeof event.request.cookies
    }
  }

  // Breadcrumb payloads often carry form data
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b: NonNullable<Event['breadcrumbs']>[number]) => ({
      ...b,
      ...(b.data ? { data: redactInPlace(b.data) as typeof b.data } : {}),
    }))
  }

  // Extra + contexts
  if (event.extra) {
    event.extra = redactInPlace(event.extra) as typeof event.extra
  }
  if (event.contexts) {
    event.contexts = redactInPlace(event.contexts) as typeof event.contexts
  }

  return event
}
