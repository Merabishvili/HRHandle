'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { uploadDocument, deleteDocument, getDocumentSignedUrl } from '@/lib/actions/documents'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Paperclip, Trash2, ExternalLink, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Document {
  id: string
  file_name: string
  file_size: number
  mime_type: string
  document_type: string
  created_at: string
}

interface CandidateDocumentsProps {
  candidateId: string
  initialDocuments: Document[]
}

const DOCUMENT_TYPE_I18N_KEY: Record<string, string> = {
  cv: 'documents.typeCv',
  cover_letter: 'documents.typeCoverLetter',
  other: 'documents.typeOther',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CandidateDocuments({ candidateId, initialDocuments }: CandidateDocumentsProps) {
  const t = useTranslations()
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [documentType, setDocumentType] = useState('cv')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = (file: File) => {
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', documentType)

    startTransition(async () => {
      const result = await uploadDocument(candidateId, fd)
      if (!result.success) {
        setError(result.error)
        return
      }
      const optimistic: Document = {
        id: result.data.id,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        document_type: documentType,
        created_at: new Date().toISOString(),
      }
      setDocuments((prev) => [optimistic, ...prev])
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  const handleDelete = (docId: string) => {
    startTransition(async () => {
      const result = await deleteDocument(docId)
      if (!result.success) {
        setError(result.error)
        return
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
    })
  }

  const handleOpen = (docId: string, mimeType: string) => {
    startTransition(async () => {
      const result = await getDocumentSignedUrl(docId)
      if (!result.success) {
        setError(result.error)
        return
      }
      const isWord =
        mimeType === 'application/msword' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const target = isWord
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(result.data.url)}`
        : result.data.url
      window.open(target, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>{t('documents.title')}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Select value={documentType} onValueChange={setDocumentType} disabled={isPending}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cv">{t('documents.typeCv')}</SelectItem>
              <SelectItem value="cover_letter">{t('documents.typeCoverLetter')}</SelectItem>
              <SelectItem value="other">{t('documents.typeOther')}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="mr-2 h-4 w-4" />
            )}
            {t('common.upload')}
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground">{t('documents.hint')}</p>

        {documents.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('documents.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOCUMENT_TYPE_I18N_KEY[doc.document_type] ? t(DOCUMENT_TYPE_I18N_KEY[doc.document_type]!) : doc.document_type} ·{' '}
                      {formatBytes(doc.file_size)} ·{' '}
                      {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title={t('documents.openNewTab')}
                    aria-label={t('documents.openAria')}
                    onClick={() => handleOpen(doc.id, doc.mime_type)}
                    disabled={isPending}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label={t('documents.deleteAria')}
                    onClick={() => handleDelete(doc.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
