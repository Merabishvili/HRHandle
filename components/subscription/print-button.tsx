'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer className="mr-2 h-3.5 w-3.5" aria-hidden />
      {label}
    </Button>
  )
}
