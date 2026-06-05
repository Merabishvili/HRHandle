import { describe, it, expect, vi, beforeEach } from 'vitest'

const parseCVFileMock = vi.fn()
const headersMock = vi.fn()

vi.mock('@/lib/cv-parser', () => ({
  parseCVFile: (file: File) => parseCVFileMock(file),
}))

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: (k: string) => headersMock(k) }),
}))

import { POST } from '@/app/api/parse-cv/route'
import { NextRequest } from 'next/server'

function makeReq(formData: FormData): NextRequest {
  // NextRequest doesn't accept FormData directly via the constructor in this environment;
  // we build a Request with the multipart body and let Next derive formData.
  const body = formData
  return new NextRequest('http://localhost/api/parse-cv', {
    method: 'POST',
    body: body as unknown as BodyInit,
  })
}

function setIp(ip: string | null) {
  headersMock.mockImplementation((key: string) => {
    if (key === 'x-forwarded-for') return ip
    return null
  })
}

describe('POST /api/parse-cv', () => {
  beforeEach(() => {
    parseCVFileMock.mockReset()
    headersMock.mockReset()
  })

  it('returns 400 + parse_failed when no file is attached', async () => {
    // unique IP per test so we don't trip the cross-test rate limiter
    setIp('10.0.0.1')
    const fd = new FormData()
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ success: false, reason: 'parse_failed' })
  })

  it('returns 400 + parse_failed for a disallowed MIME type', async () => {
    setIp('10.0.0.2')
    const fd = new FormData()
    fd.set('file', new File(['hello'], 'cv.txt', { type: 'text/plain' }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.reason).toBe('parse_failed')
    expect(parseCVFileMock).not.toHaveBeenCalled()
  })

  it('returns 200 on successful parse and forwards parser output', async () => {
    setIp('10.0.0.3')
    parseCVFileMock.mockResolvedValue({ success: true, parsed: { firstName: 'Ada' } })
    const fd = new FormData()
    fd.set('file', new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.parsed.firstName).toBe('Ada')
  })

  it('returns 504 when the parser reports timeout', async () => {
    setIp('10.0.0.4')
    parseCVFileMock.mockResolvedValue({ success: false, reason: 'timeout' })
    const fd = new FormData()
    fd.set('file', new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(504)
    const body = await res.json()
    expect(body.reason).toBe('timeout')
  })

  it('returns 422 when the parser reports any other failure reason', async () => {
    setIp('10.0.0.5')
    parseCVFileMock.mockResolvedValue({ success: false, reason: 'schema_invalid' })
    const fd = new FormData()
    fd.set('file', new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.reason).toBe('schema_invalid')
  })

  it('rate-limits the 11th request from the same IP within the hour', async () => {
    setIp('10.0.0.99')
    parseCVFileMock.mockResolvedValue({ success: true, parsed: {} })

    for (let i = 0; i < 10; i++) {
      const fd = new FormData()
      fd.set('file', new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' }))
      const res = await POST(makeReq(fd))
      expect(res.status).toBe(200)
    }

    const fd = new FormData()
    fd.set('file', new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.reason).toBe('rate_limited')
  })

  it('does not rate-limit when the IP is "unknown" (no forwarded header)', async () => {
    setIp(null)
    parseCVFileMock.mockResolvedValue({ success: true, parsed: {} })
    const fd = new FormData()
    fd.set('file', new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' }))

    // 15 requests > the 10/hr cap — should all succeed because ip='unknown' bypasses the limiter
    for (let i = 0; i < 15; i++) {
      const res = await POST(makeReq(fd))
      expect(res.status).toBe(200)
    }
  })
})
