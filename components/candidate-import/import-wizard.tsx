'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'
import { Upload, Download, FileText, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  REQUIRED_FIELDS,
  MAX_FILE_BYTES,
  MAX_ROWS,
  inferMapping,
  missingRequiredFields,
  pickCell,
  type ImportField,
} from '@/lib/candidate-import/parsing'
import {
  buildErrorReportCsv,
  validateRow,
  type ErrorReportRow,
} from '@/lib/candidate-import/validation'
import {
  importCandidates,
  type ImportResult,
} from '@/lib/actions/candidate-import'

type Step = 'upload' | 'map' | 'preview' | 'done'

interface ParsedFile {
  filename: string
  headers: string[]
  rows: string[][]
}

interface ValidationSummary {
  validRows: { rowNumber: number; data: ReturnType<typeof validateRow> }[]
  failures: ErrorReportRow[]
}

export function ImportWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<(ImportField | null)[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [failures, setFailures] = useState<ErrorReportRow[]>([])
  const [isPending, startTransition] = useTransition()

  function reset() {
    setStep('upload')
    setError(null)
    setParsed(null)
    setMapping([])
    setResult(null)
    setFailures([])
  }

  function onFile(file: File) {
    setError(null)
    if (file.size > MAX_FILE_BYTES) {
      setError(`File too large. Max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB.`)
      return
    }
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`Parse error: ${results.errors[0]?.message ?? 'unknown'}`)
          return
        }
        const data = results.data as string[][]
        if (data.length === 0) {
          setError('File is empty')
          return
        }
        const headers = (data[0] ?? []).map((h) => String(h ?? ''))
        const rows = data.slice(1)
        if (rows.length === 0) {
          setError('No data rows found after header')
          return
        }
        if (rows.length > MAX_ROWS) {
          setError(`Too many rows. Max ${MAX_ROWS}.`)
          return
        }
        setParsed({ filename: file.name, headers, rows })
        setMapping(inferMapping(headers))
        setStep('map')
      },
      error: (err) => {
        setError(`Parse error: ${err.message}`)
      },
    })
  }

  function buildValidation(): ValidationSummary {
    if (!parsed) return { validRows: [], failures: [] }
    const valid: ValidationSummary['validRows'] = []
    const failures: ErrorReportRow[] = []
    parsed.rows.forEach((row, idx) => {
      const values: Partial<Record<ImportField, string | null>> = {}
      for (const field of IMPORT_FIELDS) {
        values[field] = pickCell(row, mapping, field)
      }
      const res = validateRow({ values })
      if (res.ok) {
        valid.push({ rowNumber: idx + 2, data: res })
      } else {
        failures.push({ rowNumber: idx + 2, original: row, error: res.error })
      }
    })
    return { validRows: valid, failures }
  }

  function onSubmit() {
    if (!parsed) return
    const { validRows, failures } = buildValidation()
    if (validRows.length === 0) {
      setError('No rows passed validation. Fix errors and try again.')
      setFailures(failures)
      return
    }
    setError(null)
    startTransition(async () => {
      const rows = validRows.map((v) => (v.data.ok ? v.data.row : null)).filter((r): r is NonNullable<typeof r> => r !== null)
      const res = await importCandidates({ filename: parsed.filename, rows })
      if (!res.success) {
        setError(res.error)
        return
      }
      setResult(res.data)
      setFailures(failures)
      setStep('done')
      router.refresh()
    })
  }

  function downloadFailures() {
    if (!parsed || failures.length === 0) return
    const csv = buildErrorReportCsv(parsed.headers, failures)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `import-errors-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (step === 'upload') {
    return (
      <UploadStep onFile={onFile} error={error} />
    )
  }

  if (step === 'map' && parsed) {
    const missing = missingRequiredFields(mapping)
    return (
      <MapStep
        parsed={parsed}
        mapping={mapping}
        onChange={setMapping}
        onBack={reset}
        onNext={() => {
          if (missing.length > 0) {
            setError(`Missing required field${missing.length === 1 ? '' : 's'}: ${missing.map((f) => IMPORT_FIELD_LABELS[f]).join(', ')}`)
            return
          }
          setError(null)
          setStep('preview')
        }}
        error={error}
      />
    )
  }

  if (step === 'preview' && parsed) {
    const summary = buildValidation()
    return (
      <PreviewStep
        summary={summary}
        onBack={() => setStep('map')}
        onSubmit={onSubmit}
        isPending={isPending}
        error={error}
      />
    )
  }

  if (step === 'done' && result) {
    return (
      <DoneStep
        result={result}
        failures={failures}
        onDownloadFailures={downloadFailures}
        onAnother={reset}
      />
    )
  }

  return null
}

function UploadStep({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const [dragging, setDragging] = useState(false)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Upload a CSV with up to {MAX_ROWS} candidates. Required: first name, last name, email.
        </p>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href="/hrhandle-candidates-template.csv" download>
            <Download className="h-4 w-4" />
            Download template
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
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) onFile(file)
          }}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drag a CSV file here</p>
          <p className="text-xs text-muted-foreground">or</p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onFile(file)
                e.target.value = ''
              }}
            />
            <span className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent">
              Choose file
            </span>
          </label>
          <p className="text-xs text-muted-foreground">Max {Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB</p>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function MapStep({
  parsed,
  mapping,
  onChange,
  onBack,
  onNext,
  error,
}: {
  parsed: ParsedFile
  mapping: (ImportField | null)[]
  onChange: (m: (ImportField | null)[]) => void
  onBack: () => void
  onNext: () => void
  error: string | null
}) {
  function updateMapping(idx: number, value: string) {
    const next = [...mapping]
    const field = value === '__none__' ? null : (value as ImportField)
    if (field !== null) {
      for (let i = 0; i < next.length; i++) {
        if (i !== idx && next[i] === field) next[i] = null
      }
    }
    next[idx] = field
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Map columns</h2>
          <p className="text-sm text-muted-foreground">
            <FileText className="mr-1 inline h-3 w-3" />
            {parsed.filename} — {parsed.rows.length} row{parsed.rows.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-medium">CSV column</th>
                <th className="px-4 py-2 text-left font-medium">Sample</th>
                <th className="px-4 py-2 text-left font-medium">Map to field</th>
              </tr>
            </thead>
            <tbody>
              {parsed.headers.map((h, idx) => {
                const sample = parsed.rows[0]?.[idx] ?? ''
                return (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{h || <span className="text-muted-foreground">(blank)</span>}</td>
                    <td className="max-w-[240px] truncate px-4 py-2 text-muted-foreground">{sample}</td>
                    <td className="px-4 py-2">
                      <Select value={mapping[idx] ?? '__none__'} onValueChange={(v) => updateMapping(idx, v)}>
                        <SelectTrigger className="h-8 w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Ignore —</SelectItem>
                          {IMPORT_FIELDS.map((f) => (
                            <SelectItem key={f} value={f}>
                              {IMPORT_FIELD_LABELS[f]}
                              {REQUIRED_FIELDS.includes(f) ? ' *' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Start over
        </Button>
        <Button onClick={onNext}>Preview import</Button>
      </div>
    </div>
  )
}

function PreviewStep({
  summary,
  onBack,
  onSubmit,
  isPending,
  error,
}: {
  summary: ValidationSummary
  onBack: () => void
  onSubmit: () => void
  isPending: boolean
  error: string | null
}) {
  const previewValid = summary.validRows.slice(0, 10)
  const previewFailures = summary.failures.slice(0, 10)
  const hasErrors = summary.failures.length > 0

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Preview</h2>
        <p className="text-sm text-muted-foreground">
          {summary.validRows.length} valid · {summary.failures.length} with errors · duplicates will be skipped
        </p>
      </div>

      {previewValid.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-2 text-sm font-medium">
              First {previewValid.length} valid row{previewValid.length === 1 ? '' : 's'}
            </div>
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Row</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-left">Position</th>
                </tr>
              </thead>
              <tbody>
                {previewValid.map((v) => {
                  if (!v.data.ok) return null
                  const r = v.data.row
                  return (
                    <tr key={v.rowNumber} className="border-b last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{v.rowNumber}</td>
                      <td className="px-3 py-2">
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="px-3 py-2">{r.email}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.current_company ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.current_position ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {hasErrors && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {summary.failures.length} row{summary.failures.length === 1 ? '' : 's'} with errors (will be skipped)
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Row</th>
                  <th className="px-3 py-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {previewFailures.map((f) => (
                  <tr key={f.rowNumber} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{f.rowNumber}</td>
                    <td className="px-3 py-2 text-destructive">{f.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summary.failures.length > previewFailures.length && (
              <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                ...and {summary.failures.length - previewFailures.length} more — the error report after import will list all of them.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2" disabled={isPending}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onSubmit} disabled={isPending || summary.validRows.length === 0}>
          {isPending
            ? 'Importing…'
            : `Import ${summary.validRows.length} candidate${summary.validRows.length === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  )
}

function DoneStep({
  result,
  failures,
  onDownloadFailures,
  onAnother,
}: {
  result: ImportResult
  failures: ErrorReportRow[]
  onDownloadFailures: () => void
  onAnother: () => void
}) {
  return (
    <div className="space-y-4">
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Import complete</AlertTitle>
        <AlertDescription>
          Imported {result.imported} candidate{result.imported === 1 ? '' : 's'}.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{result.imported} imported</Badge>
        {result.skipped_duplicate > 0 && (
          <Badge variant="outline">{result.skipped_duplicate} duplicate skipped</Badge>
        )}
        {failures.length > 0 && (
          <Badge variant="destructive">{failures.length} errored</Badge>
        )}
      </div>

      {failures.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDownloadFailures} className="gap-2">
            <Download className="h-4 w-4" />
            Download error report
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button asChild>
          <Link href="/candidates">View candidates</Link>
        </Button>
        <Button variant="outline" onClick={onAnother}>
          Import another file
        </Button>
      </div>
    </div>
  )
}
