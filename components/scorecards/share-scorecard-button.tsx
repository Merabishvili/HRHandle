'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Share2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ShareScorecardDialog } from './share-scorecard-dialog'

export interface ShareScorecardButtonProps {
  applicationId: string
  candidateName: string
  vacancyTitle: string
}

// Tiny trigger pill that opens the share dialog. Rendered next to the
// evaluation block on the candidate detail page, owner/admin-gated by the
// caller (the server action also rejects non-admins as belt + braces).
export function ShareScorecardButton({
  applicationId,
  candidateName,
  vacancyTitle,
}: ShareScorecardButtonProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Share2 className="h-3.5 w-3.5" />
        {t('vacOverview.share')}
      </Button>
      <ShareScorecardDialog
        open={open}
        onOpenChange={setOpen}
        applicationId={applicationId}
        candidateName={candidateName}
        vacancyTitle={vacancyTitle}
      />
    </>
  )
}
