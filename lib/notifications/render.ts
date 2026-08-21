/**
 * Render an in-app notification's title/body in the viewer's UI language.
 *
 * Notifications are stored once but read by recipients who may each have a
 * different UI language, so we can't pre-render a single localized string. We
 * store the variables in `data` (see createOrgNotifications) and localize here
 * at display time. Rows without `data` (created before the migration / column
 * populated) fall back to the stored English `title`/`body`.
 */
type Translate = (key: string, values?: Record<string, string | number>) => string

export interface NotificationForRender {
  type: string
  data: Record<string, unknown> | null
  /** Pre-rendered English fallback for pre-`data` rows. */
  title: string
  body: string | null
}

export interface RenderedNotification {
  title: string
  body: string | null
}

const str = (v: unknown): string => (v == null ? '' : String(v))

export function renderNotification(t: Translate, n: NotificationForRender): RenderedNotification {
  // Old rows have no structured payload — keep their stored (English) text.
  if (!n.data) return { title: n.title, body: n.body ?? null }
  const d = n.data

  switch (n.type) {
    case 'new_application':
      return {
        title: t('notif.newApplication.title', { name: str(d.name) }),
        body: d.vacancy ? t('notif.forVacancy', { vacancy: str(d.vacancy) }) : null,
      }
    case 'interview_scheduled':
      return {
        title: t('notif.interviewScheduled.title', { name: str(d.name) }),
        body: d.vacancy ? t('notif.forVacancy', { vacancy: str(d.vacancy) }) : null,
      }
    case 'interview_reminder':
      return {
        title: t('notif.interviewReminder.title', { name: str(d.name) }),
        body: d.vacancy ? t('notif.forVacancy', { vacancy: str(d.vacancy) }) : null,
      }
    case 'candidate_hired':
      return {
        title: t('notif.candidateHired.title', { name: str(d.name) }),
        body: d.vacancy ? t('notif.forVacancy', { vacancy: str(d.vacancy) }) : null,
      }
    case 'team_invite_sent':
      return {
        title: t('notif.teamInvite.title', { email: str(d.email) }),
        body: t('notif.teamInvite.body', { inviter: str(d.inviter), role: str(d.role) }),
      }
    case 'plan_limit_reached':
      return {
        title: t('notif.planLimit.title', { limit: str(d.limit) }),
        body: t('notif.planLimit.body'),
      }
    case 'note_mention':
      // The body is the note preview (user content) — never localized.
      return {
        title: t('notif.noteMention.title', { author: str(d.author), candidate: str(d.candidate) }),
        body: n.body ?? null,
      }
    case 'offer_accepted':
      return { title: d.name ? t('notif.offerAccepted.title', { name: str(d.name) }) : n.title, body: null }
    case 'offer_declined':
      return { title: d.name ? t('notif.offerDeclined.title', { name: str(d.name) }) : n.title, body: null }
    case 'application_withdrawn':
      return { title: t('notif.applicationWithdrawn.title'), body: null }
    default:
      return { title: n.title, body: n.body ?? null }
  }
}
