export type GuideCategory = 'getting-started' | 'recruiting' | 'communication' | 'team'

export interface GuideMeta {
  slug: string
  title: string
  summary: string
  category: GuideCategory
  order: number
}

export const GUIDES: readonly GuideMeta[] = [
  {
    slug: 'post-a-vacancy',
    title: 'Post a vacancy',
    summary: 'Create a new job opening and share a public apply link.',
    category: 'getting-started',
    order: 10,
  },
  {
    slug: 'sign-up-and-onboarding',
    title: 'Sign up and onboarding',
    summary: 'Create your organization and start your 7-day free trial.',
    category: 'getting-started',
    order: 20,
  },
  {
    slug: 'public-apply-link',
    title: 'Public apply link',
    summary: 'Share a branded application form for any open vacancy.',
    category: 'getting-started',
    order: 30,
  },
  {
    slug: 'manage-candidates',
    title: 'Manage candidates',
    summary: 'Add, edit, and organize candidates in your talent pool.',
    category: 'recruiting',
    order: 40,
  },
  {
    slug: 'pipeline-kanban',
    title: 'Pipeline (Kanban)',
    summary: 'Move applications through stages with drag and drop.',
    category: 'recruiting',
    order: 50,
  },
  {
    slug: 'assessments-and-questions',
    title: 'Assessments and questions',
    summary: 'Add scoring criteria and open-ended questions per vacancy.',
    category: 'recruiting',
    order: 60,
  },
  {
    slug: 'custom-fields',
    title: 'Custom fields',
    summary: 'Capture extra data on vacancies and candidates.',
    category: 'recruiting',
    order: 70,
  },
  {
    slug: 'schedule-interview',
    title: 'Schedule interview',
    summary: 'Book interviews and auto-create Google Meet, Zoom, or Teams links.',
    category: 'communication',
    order: 80,
  },
  {
    slug: 'candidate-emails',
    title: 'Candidate emails',
    summary: 'Configure rejection templates and applicant communications.',
    category: 'communication',
    order: 90,
  },
  {
    slug: 'linkedin-integration',
    title: 'LinkedIn integration',
    summary: 'Connect a company page and post vacancies to LinkedIn Jobs.',
    category: 'communication',
    order: 100,
  },
  {
    slug: 'team-and-roles',
    title: 'Team and roles',
    summary: 'Invite teammates and assign owner, admin, or member roles.',
    category: 'team',
    order: 110,
  },
] as const

export const CATEGORY_LABELS: Record<GuideCategory, string> = {
  'getting-started': 'Getting started',
  recruiting: 'Recruiting',
  communication: 'Communication',
  team: 'Team',
}

export function getGuideBySlug(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug)
}

export function getGuidesByCategory(): Record<GuideCategory, GuideMeta[]> {
  const grouped: Record<GuideCategory, GuideMeta[]> = {
    'getting-started': [],
    recruiting: [],
    communication: [],
    team: [],
  }
  for (const guide of [...GUIDES].sort((a, b) => a.order - b.order)) {
    grouped[guide.category].push(guide)
  }
  return grouped
}
