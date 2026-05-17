import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LinkedInSelectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const cookieStore = await cookies()
  const pendingRaw = cookieStore.get('linkedin_pending')?.value

  if (!pendingRaw) redirect('/settings/integrations?linkedin=error')

  let pages: Array<{ id: string; name: string }> = []
  try {
    const pending = JSON.parse(pendingRaw)
    pages = pending.pages ?? []
  } catch {
    redirect('/settings/integrations?linkedin=error')
  }

  if (pages.length === 0) redirect('/settings/integrations?linkedin=no_pages')

  return (
    <div className="max-w-md">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Select a LinkedIn Company Page</CardTitle>
          <CardDescription>
            Choose which company page to connect to HRHandle for job postings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/integrations/linkedin/select" method="POST" className="space-y-3">
            {pages.map((page) => (
              <label
                key={page.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 hover:bg-accent"
              >
                <input type="radio" name="page_id" value={page.id} className="accent-primary" required />
                <span className="text-sm font-medium">{page.name}</span>
              </label>
            ))}
            <Button type="submit" className="w-full mt-4">Connect Selected Page</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
