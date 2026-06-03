import Link from 'next/link'
import { headers } from 'next/headers'
import { Briefcase, Mail, Globe } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getRequestCountry } from '@/lib/sanctions'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Not available in your region — HRHandle',
  robots: { index: false, follow: false },
}

export default async function NotAvailablePage() {
  const headersList = await headers()
  const country = getRequestCountry(headersList)

  return (
    <div className="min-h-screen bg-background px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">HRHandle</span>
          </Link>
        </div>

        <Card className="border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Not available in your region</CardTitle>
            <CardDescription>
              {country
                ? `Account sign-up is not available from your region (${country}).`
                : 'Account sign-up is not available from your region.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Globe className="h-4 w-4" />
                Why am I seeing this?
              </div>
              <p className="mt-1 text-muted-foreground">
                HRHandle is unable to open new accounts in jurisdictions that are subject to
                comprehensive international sanctions or are on the FATF call-for-action list.
                This applies to new sign-ups only — existing customers retain access.
              </p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Mail className="h-4 w-4" />
                Believe this is an error?
              </div>
              <p className="mt-1 text-muted-foreground">
                If you are travelling, using a corporate VPN, or otherwise believe the
                detected region is incorrect, email us at{' '}
                <a href="mailto:hrhandle26@gmail.com" className="underline hover:text-foreground">
                  hrhandle26@gmail.com
                </a>{' '}
                from the address you intend to use. We&apos;ll respond within two business days.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/">Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          {' · '}
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </p>
      </div>
    </div>
  )
}
