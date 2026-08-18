/**
 * A-8b — Cheap user-agent string parser for the Active Sessions list.
 *
 * Not a full UA parsing library — just enough to pick a sensible icon
 * (monitor / smartphone / tablet) and a friendly device + browser
 * label per the design.
 */

export type DeviceKind = 'desktop' | 'mobile' | 'tablet' | 'unknown'

export interface ParsedUserAgent {
  device: DeviceKind
  os: string
  browser: string
}

const OS_PATTERNS: { match: RegExp; label: string; device: DeviceKind }[] = [
  { match: /iPhone|iPod/, label: 'iPhone', device: 'mobile' },
  { match: /iPad/, label: 'iPad', device: 'tablet' },
  { match: /Android.*Mobile/, label: 'Android', device: 'mobile' },
  { match: /Android/, label: 'Android', device: 'tablet' },
  { match: /Mac OS X/, label: 'macOS', device: 'desktop' },
  { match: /Windows NT/, label: 'Windows', device: 'desktop' },
  { match: /CrOS/, label: 'ChromeOS', device: 'desktop' },
  { match: /Linux/, label: 'Linux', device: 'desktop' },
]

const BROWSER_PATTERNS: { match: RegExp; label: string }[] = [
  // Order matters — Edge before Chrome, Chrome before Safari, etc.
  { match: /Edg\//, label: 'Edge' },
  { match: /OPR\//, label: 'Opera' },
  { match: /Firefox\//, label: 'Firefox' },
  { match: /Chrome\//, label: 'Chrome' },
  { match: /Safari\//, label: 'Safari' },
]

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) return { device: 'unknown', os: 'Unknown device', browser: 'Unknown browser' }

  let os = 'Unknown device'
  let device: DeviceKind = 'unknown'
  for (const p of OS_PATTERNS) {
    if (p.match.test(ua)) {
      os = p.label
      device = p.device
      break
    }
  }

  let browser = 'Unknown browser'
  for (const p of BROWSER_PATTERNS) {
    if (p.match.test(ua)) {
      browser = p.label
      break
    }
  }

  return { device, os, browser }
}
