'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import type { Candidate, CandidateFormData, Vacancy } from '@/lib/types'

interface CandidateFormProps {
  candidate?: Candidate
  vacancies: Vacancy[]
  organizationId: string
  defaultVacancyId?: string
}

export function CandidateForm({ candidate, vacancies, organizationId, defaultVacancyId }: CandidateFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<CandidateFormData>({
    full_name: candidate?.full_name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    vacancy_id: candidate?.vacancy_id || defaultVacancyId || '',
    linkedin_url: candidate?.linkedin_url || '',
    source: candidate?.source || '',
    notes: candidate?.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()

    const payload = {
      ...formData,
      organization_id: organizationId,
      vacancy_id: formData.vacancy_id || null,
      phone: formData.phone || null,
      linkedin_url: formData.linkedin_url || null,
      source: formData.source || null,
      notes: formData.notes || null,
    }

    let result
    if (candidate) {
      result = await supabase
        .from('candidates')
        .update(payload)
        .eq('id', candidate.id)
    } else {
      result = await supabase
        .from('candidates')
        .insert(payload)
    }

    if (result.error) {
      setError(result.error.message)
      setIsLoading(false)
      return
    }

    router.push('/candidates')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Basic details about the candidate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              placeholder="e.g. John Smith"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
            <Input
              id="linkedin_url"
              type="url"
              placeholder="https://linkedin.com/in/johnsmith"
              value={formData.linkedin_url}
              onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Application Details</CardTitle>
          <CardDescription>Position and source information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vacancy_id">Position</Label>
              <Select
                value={formData.vacancy_id || 'none'}
                onValueChange={(value) => 
                  setFormData({ ...formData, vacancy_id: value === 'none' ? '' : value })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="vacancy_id">
                  <SelectValue placeholder="Select a position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No position assigned</SelectItem>
                  {vacancies.map((vacancy) => (
                    <SelectItem key={vacancy.id} value={vacancy.id}>
                      {vacancy.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={formData.source || 'none'}
                onValueChange={(value) => 
                  setFormData({ ...formData, source: value === 'none' ? '' : value })
                }
                disabled={isLoading}
              >
                <SelectTrigger id="source">
                  <SelectValue placeholder="How did they apply?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="Indeed">Indeed</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                  <SelectItem value="Company Website">Company Website</SelectItem>
                  <SelectItem value="Job Board">Job Board</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this candidate..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={isLoading}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {candidate ? 'Updating...' : 'Adding...'}
            </>
          ) : candidate ? (
            'Update Candidate'
          ) : (
            'Add Candidate'
          )}
        </Button>
      </div>
    </form>
  )
}
