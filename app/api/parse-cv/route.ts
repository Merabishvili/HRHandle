import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { parseCVFile } from '@/lib/cv-parser'

// Use Frankfurt region — US East (iad1 default) is blocked by Google's API firewall
export const preferredRegion = 'fra1'

const MAX_PARSE_REQUESTS_PER_IP_PER_HOUR = 10
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// In-memory rate limit store — resets on cold start, sufficient for edge-case abuse prevention
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }

  if (entry.count >= MAX_PARSE_REQUESTS_PER_IP_PER_HOUR) {
    return false
  }

  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  // ── 1. IP rate limiting ────────────────────────────────────────────────────
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'

  if (ip !== 'unknown' && !checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, reason: 'rate_limited' },
      { status: 429 }
    )
  }

  // ── 2. Parse multipart form ────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { success: false, reason: 'parse_failed' },
      { status: 400 }
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { success: false, reason: 'parse_failed' },
      { status: 400 }
    )
  }

  // ── 3. File validation ─────────────────────────────────────────────────────
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { success: false, reason: 'parse_failed' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { success: false, reason: 'parse_failed' },
      { status: 400 }
    )
  }

  // ── 4. Parse CV ────────────────────────────────────────────────────────────
  const result = await parseCVFile(file)

  if (!result.success) {
    const statusCode = result.reason === 'timeout' ? 504 : 422
    return NextResponse.json(result, { status: statusCode })
  }

  return NextResponse.json(result)
}
