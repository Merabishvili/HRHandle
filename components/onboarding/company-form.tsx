'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { completeCompanyOnboarding } from '@/lib/actions/onboarding'

export interface CompanyOnboardingFormProps {
  defaultFullName: string
}

export function CompanyOnboardingForm({ defaultFullName }: CompanyOnboardingFormProps) {
  const [fullName, setFullName] = useState<string>(defaultFullName)
  const [companyName, setCompanyName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await completeCompanyOnboarding({
        fullName: fullName.trim(),
        companyName: companyName.trim(),
      })
      // Server action redirects on success — we only land back here on failure.
      if (result && !result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <Card className="border-border">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Finish setting up</CardTitle>
        <CardDescription>Tell us a bit about you and your company to get started.</CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Your name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isPending}
              autoFocus={!defaultFullName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              type="text"
              placeholder="e.g., Acme Recruiting"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              disabled={isPending}
              autoFocus={!!defaultFullName}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up…
              </>
            ) : (
              'Open dashboard'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
