'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrganization } from '@/lib/actions/settings'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, Upload, X } from 'lucide-react'
import type { Organization } from '@/lib/types'

interface OrganizationFormProps {
  organization: Organization
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function OrganizationForm({ organization }: OrganizationFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(organization.name)

  // Logo state: null = remove, undefined = unchanged, string = new URL or existing
  const [logoUrl, setLogoUrl] = useState<string | null>(organization.logo_url ?? null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(organization.logo_url ?? null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Image must be smaller than 2 MB.')
      return
    }

    setError(null)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsLoading(true)

    let finalLogoUrl: string | null | undefined = undefined // undefined = don't change

    if (logoFile) {
      // Upload new logo to Supabase Storage
      const supabase = createClient()
      const ext = logoFile.name.split('.').pop() || 'jpg'
      const path = `${organization.id}/logo.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type })

      if (uploadError) {
        setError('Failed to upload logo. Please try again.')
        setIsLoading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('org-logos').getPublicUrl(path)
      // Append cache-buster so the browser doesn't show the old image after update
      finalLogoUrl = `${publicUrl}?t=${Date.now()}`
    } else if (logoUrl === null && organization.logo_url) {
      // User explicitly removed the logo
      finalLogoUrl = null
    }
    // else: neither new file nor removal — don't update logo_url

    const result = await updateOrganization(organization.id, {
      name,
      ...(finalLogoUrl !== undefined ? { logo_url: finalLogoUrl } : {}),
    })

    if (!result.success) {
      setError(result.error)
    } else {
      setSuccess(true)
      setLogoFile(null)
      if (finalLogoUrl !== undefined) setLogoUrl(finalLogoUrl)
      router.refresh()
    }

    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Organization updated successfully!</AlertDescription>
        </Alert>
      )}

      {/* Logo upload */}
      <div className="space-y-3">
        <Label>Organization Logo</Label>
        <div className="flex items-center gap-4">
          {/* Preview */}
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-muted overflow-hidden">
            {logoPreview ? (
              <>
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="h-full w-full object-contain"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={isLoading}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <span className="text-xl font-bold text-muted-foreground">
                {name?.[0]?.toUpperCase() || '?'}
              </span>
            )}
          </div>

          {/* Upload button */}
          <div className="space-y-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {logoPreview ? 'Replace logo' : 'Upload logo'}
            </Button>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, WebP or GIF · max 2 MB
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="orgName">Organization Name</Label>
        <Input
          id="orgName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your company name"
          disabled={isLoading}
        />
      </div>

      {/* Slug (read-only) */}
      <div className="space-y-2">
        <Label htmlFor="slug">URL Slug</Label>
        <Input id="slug" value={organization.slug} disabled className="bg-muted" />
        <p className="text-xs text-muted-foreground">Organization slug cannot be changed.</p>
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
      </Button>
    </form>
  )
}
