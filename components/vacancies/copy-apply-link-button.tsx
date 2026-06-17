'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || ''

interface CopyApplyLinkButtonProps {
  token: string
}

/**
 * Header-level "Copy apply link" action per S04 §2.1 / Q-S04-b. Toast
 * confirmation on success (the lean from the open-questions table) and a
 * brief visual check-icon swap so the button reads as having done
 * something even before the toast fires.
 *
 * Rendered conditionally — the parent only mounts this when the vacancy
 * has an application_form_token set. When the form is deactivated, the
 * parent unmounts this and shows the appropriate empty-state messaging
 * inside the apply-form configuration tab instead.
 */
export function CopyApplyLinkButton({ token }: CopyApplyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  const onClick = async () => {
    const url = `${BASE_URL}/apply/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Apply link copied to clipboard.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Browsers without clipboard access in iframes or insecure contexts.
      toast.error('Could not copy — your browser blocked clipboard access.')
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={onClick}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      Copy apply link
    </Button>
  )
}
