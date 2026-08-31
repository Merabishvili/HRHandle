'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, Download, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MAX_FILE_BYTES, MAX_ROWS } from '@/lib/candidate-import/parsing'
import type { ValidatedRow } from '@/lib/candidate-import/validation'
import { ImportStepper } from './import-stepper'
import type { Dataset } from './import-flow'

interface ParseResponse {
  importId: string
  filename: string
  columns: number
  size: number
  rows: ValidatedRow[]
  counts: { total: number; ready: number; error: number }
  existingEmails: string[]
}

export function UploadStep({ onParsed }: { onParsed: (ds: Dataset) => void }) {
  const t = useTranslations()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    if (file.size > MAX_FILE_BYTES) {
      setError(t('csvImport.errTooLarge', { mb: Math.round(MAX_FILE_BYTES / (1024 * 1024)) }))
      return
    }
    setParsing(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/candidates/import/parse', { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) {
        setError(mapError(t, body))
        return
      }
      const data = body as ParseResponse
      onParsed({
        importId: data.importId,
        filename: data.filename,
        columns: data.columns,
        size: data.size,
        rows: data.rows,
        existingEmails: new Set(data.existingEmails),
      })
    } catch {
      setError(t('csvImport.errGeneric'))
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="space-y-6">
      <ImportStepper current="upload" />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('csvImport.uploadHint', { max: MAX_ROWS })}</p>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href="/hrhandle-candidates-template.csv" download>
            <Download className="h-4 w-4" />
            {t('csvImport.downloadTemplate')}
          </a>
        </Button>
      </div>

      <Card>
        <CardContent
          className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed py-12 transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            if (!parsing) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (parsing) return
            const file = e.dataTransfer.files[0]
            if (file) void handleFile(file)
          }}
        >
          {parsing ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">{t('csvImport.parsing')}</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{t('csvImport.dragHere')}</p>
              <p className="text-xs text-muted-foreground">{t('csvImport.or')}</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleFile(file)
                    e.target.value = ''
                  }}
                />
                <span className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent">
                  {t('csvImport.chooseFile')}
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                {t('csvImport.maxSize', { mb: Math.round(MAX_FILE_BYTES / (1024 * 1024)) })}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2">
            <span>{error}</span>
            <a
              href="/hrhandle-candidates-template.csv"
              download
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium underline"
            >
              <Download className="h-3.5 w-3.5" />
              {t('csvImport.downloadTemplate')}
            </a>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function mapError(t: ReturnType<typeof useTranslations>, body: { error?: string; header?: string; count?: number; max?: number; maxMb?: number }): string {
  switch (body.error) {
    case 'tooLarge':
      return t('csvImport.errTooLarge', { mb: body.maxMb ?? Math.round(MAX_FILE_BYTES / (1024 * 1024)) })
    case 'notUtf8':
      return t('csvImport.errNotUtf8')
    case 'empty':
      return t('csvImport.errEmpty')
    case 'noRows':
      return t('csvImport.errNoRows')
    case 'tooManyRows':
      return t('csvImport.errTooManyRows', { n: body.count ?? 0, max: body.max ?? MAX_ROWS })
    case 'unknownHeader':
      return t('csvImport.errUnknownHeader', { header: body.header ?? '' })
    case 'missingRequiredHeader':
      return t('csvImport.errMissingHeader', { header: body.header ?? '' })
    case 'parseError':
      return t('csvImport.errParseGeneric')
    case 'forbidden':
      return t('csvImport.errForbidden')
    default:
      return t('csvImport.errGeneric')
  }
}
