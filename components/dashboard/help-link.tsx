'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HelpLink() {
  const t = useTranslations()
  return (
    <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
      <Link href="/guide" target="_blank" rel="noopener noreferrer">
        <HelpCircle className="mr-1.5 h-4 w-4" />
        {t('header.help')}
      </Link>
    </Button>
  )
}
