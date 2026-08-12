import { formatDistanceToNow, format } from 'date-fns'
import { getTranslations } from 'next-intl/server'

interface MetadataFooterProps {
  source: string | null
  createdAt: string
  updatedAt: string
  candidateId: string
}

interface MetaItemProps {
  label: string
  value: string
  mono?: boolean
}

function MetaItem({ label, value, mono }: MetaItemProps) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-[11.5px] font-semibold text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

export async function MetadataFooter({ source, createdAt, updatedAt, candidateId }: MetadataFooterProps) {
  const t = await getTranslations()
  const shortId = candidateId.slice(0, 8).toUpperCase()

  return (
    <div className="rounded-lg border border-border/60 bg-muted px-5 py-3.5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <MetaItem label={t('candWizard.application.sourceLabel')} value={source || '—'} />
        <MetaItem label={t('profile.fact.added')}        value={formatDistanceToNow(new Date(createdAt), { addSuffix: true })} />
        <MetaItem label={t('profile.meta.lastUpdated')} value={format(new Date(updatedAt), 'MMM d, yyyy')} />
        <MetaItem label={t('profile.meta.candidateId')} value={shortId} mono />
      </div>
    </div>
  )
}
