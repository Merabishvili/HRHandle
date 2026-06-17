'use client'

import { useState } from 'react'
import { Mail, Phone, Linkedin, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContactCardProps {
  email: string | null
  phone: string | null
  linkedinUrl: string | null
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch (err) {
      console.error('[contact-card] clipboard write failed:', err)
    }
  }

  return (
    <>
      <button
        onClick={handleCopy}
        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={copied ? 'Copied to clipboard' : 'Copy'}
      >
        {copied
          ? <Check className="h-3.5 w-3.5 text-[oklch(0.65_0.17_145)]" aria-hidden="true" />
          : <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        }
      </button>
      {/* Live region announces the copy action for screen readers (audit AC-003) */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  )
}

interface ContactRowProps {
  icon: React.ReactNode
  label: string
  value: string
  href?: string
  isLink?: boolean
  last?: boolean
}

function ContactRow({ icon, label, value, href, isLink, last }: ContactRowProps) {
  return (
    <div className={cn('flex items-center gap-3 py-2', !last && 'border-b border-border/50')}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target={isLink ? '_blank' : undefined}
            rel={isLink ? 'noopener noreferrer' : undefined}
            className={cn(
              'truncate text-[12.5px]',
              isLink ? 'text-[oklch(0.55_0.18_250)] hover:underline' : 'text-foreground hover:underline'
            )}
          >
            {isLink ? 'View profile' : value}
          </a>
        ) : (
          <p className="truncate text-[12.5px] text-foreground">{value}</p>
        )}
      </div>
      <CopyButton value={value} />
    </div>
  )
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function ContactCard({ email, phone, linkedinUrl }: ContactCardProps) {
  const rows = [
    email       && { icon: <Mail className="h-4 w-4" />,     label: 'Email',    value: email,       href: `mailto:${email}` },
    phone       && { icon: <Phone className="h-4 w-4" />,    label: 'Phone',    value: phone,       href: `tel:${phone}` },
    linkedinUrl && { icon: <Linkedin className="h-4 w-4" />, label: 'LinkedIn', value: linkedinUrl, href: normalizeUrl(linkedinUrl), isLink: true },
  ].filter(Boolean) as ContactRowProps[]

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-1 text-[14px] font-bold text-foreground">Contact</h3>
      {rows.length === 0 ? (
        <p className="py-2 text-[12.5px] text-muted-foreground">No contact information available.</p>
      ) : (
        <div>
          {rows.map((row, i) => (
            <ContactRow key={row.label} {...row} last={i === rows.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
}
