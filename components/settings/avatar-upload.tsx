'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Upload } from 'lucide-react'

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { uploadAvatar } from '@/lib/actions/settings'

interface Props {
  currentUrl: string | null
  fullName: string
}

/** #1 — profile avatar upload. Shows the current photo (or initials) and a
 * "Change photo" picker that uploads via the uploadAvatar server action. */
export function AvatarUpload({ currentUrl, fullName }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  // Optimistic preview from the picked file, replaced by the saved URL on refresh.
  const [preview, setPreview] = useState<string | null>(null)

  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setPreview(URL.createObjectURL(file))
    const formData = new FormData()
    formData.append('file', file)
    startTransition(async () => {
      const result = await uploadAvatar(formData)
      if (!result.success) {
        toast.error(result.error)
        setPreview(null)
        return
      }
      toast.success(t('avatar.updated'))
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={preview ?? currentUrl ?? undefined} alt={fullName} />
        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="gap-1.5"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {t('avatar.change')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('avatar.hint')}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFile}
        />
      </div>
    </div>
  )
}
