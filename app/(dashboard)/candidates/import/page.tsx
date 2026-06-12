import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ImportWizard } from '@/components/candidate-import/import-wizard'
import { isOrgAdmin } from '@/lib/permissions'

export const metadata = {
  title: 'Bulk import candidates',
}

export default async function ImportCandidatesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')
  if (!isOrgAdmin(profile.role as 'owner' | 'admin' | 'member')) {
    redirect('/candidates')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link href="/candidates">
            <ArrowLeft className="h-4 w-4" />
            Back to candidates
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk import candidates</h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV. Duplicates (by email) are skipped automatically.
        </p>
      </div>

      <ImportWizard />
    </div>
  )
}
