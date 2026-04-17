import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VacancyForm } from '@/components/vacancies/vacancy-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function EditVacancyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/dashboard')
  }

  const { data: vacancy } = await supabase
    .from('vacancies')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!vacancy) {
    notFound()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/vacancies/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Vacancy</h1>
          <p className="text-muted-foreground">Update the job posting details.</p>
        </div>
      </div>

      <VacancyForm 
        vacancy={vacancy}
        organizationId={profile.organization_id} 
        userId={user.id}
      />
    </div>
  )
}
