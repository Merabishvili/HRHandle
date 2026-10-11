/**
 * The guide's table of contents. Titles and summaries are translated in
 * `messages/source.json` (`guide.topic.<id>.title|summary`); the article body
 * lives in `content/guides/<locale>/<slug>.mdx`, one file per language.
 */
export type GuideCategory =
  | 'getting-started'
  | 'vacancies'
  | 'candidates'
  | 'hiring'
  | 'communication'
  | 'ai-and-reports'
  | 'administration'

export const GUIDE_CATEGORIES: readonly GuideCategory[] = [
  'getting-started',
  'vacancies',
  'candidates',
  'hiring',
  'communication',
  'ai-and-reports',
  'administration',
]

/** Message-key segment for a category (`guide.category.<key>`). */
export const CATEGORY_KEY: Record<GuideCategory, string> = {
  'getting-started': 'gettingStarted',
  vacancies: 'vacancies',
  candidates: 'candidates',
  hiring: 'hiring',
  communication: 'communication',
  'ai-and-reports': 'aiAndReports',
  administration: 'administration',
}

export interface GuideMeta {
  slug: string
  /** Message-key segment for the title/summary (`guide.topic.<id>.*`). */
  id: string
  category: GuideCategory
  order: number
}

export const GUIDES: readonly GuideMeta[] = [
  { slug: 'sign-up-and-onboarding', id: 'signUp', category: 'getting-started', order: 10 },
  { slug: 'navigation', id: 'navigation', category: 'getting-started', order: 20 },
  { slug: 'profile-and-security', id: 'profileSecurity', category: 'getting-started', order: 30 },
  { slug: 'organization-settings', id: 'organization', category: 'getting-started', order: 40 },
  { slug: 'team-and-roles', id: 'team', category: 'getting-started', order: 50 },

  { slug: 'post-a-vacancy', id: 'createVacancy', category: 'vacancies', order: 60 },
  { slug: 'vacancy-page', id: 'vacancyPage', category: 'vacancies', order: 70 },
  { slug: 'share-a-vacancy', id: 'shareVacancy', category: 'vacancies', order: 80 },

  { slug: 'add-candidates', id: 'addCandidates', category: 'candidates', order: 90 },
  { slug: 'import-candidates', id: 'importCandidates', category: 'candidates', order: 100 },
  { slug: 'candidate-profile', id: 'candidateProfile', category: 'candidates', order: 110 },
  { slug: 'search-and-filters', id: 'search', category: 'candidates', order: 120 },

  { slug: 'pipeline', id: 'pipeline', category: 'hiring', order: 130 },
  { slug: 'assessments-and-scorecards', id: 'assessments', category: 'hiring', order: 140 },
  { slug: 'reject-candidates', id: 'reject', category: 'hiring', order: 150 },
  { slug: 'schedule-interview', id: 'interviews', category: 'hiring', order: 160 },
  { slug: 'offers', id: 'offers', category: 'hiring', order: 170 },

  { slug: 'candidate-experience', id: 'candidateExperience', category: 'communication', order: 180 },
  { slug: 'candidate-emails', id: 'emailTemplates', category: 'communication', order: 190 },
  { slug: 'notifications', id: 'notifications', category: 'communication', order: 200 },

  { slug: 'ai-features', id: 'ai', category: 'ai-and-reports', order: 210 },
  { slug: 'reports', id: 'reports', category: 'ai-and-reports', order: 220 },

  { slug: 'integrations', id: 'integrations', category: 'administration', order: 230 },
  { slug: 'custom-fields', id: 'customFields', category: 'administration', order: 240 },
  { slug: 'audit-log-and-trash', id: 'auditTrash', category: 'administration', order: 250 },
  { slug: 'billing', id: 'billing', category: 'administration', order: 260 },
]

/** FAQ on the guide home page, in order (`guide.faq.<key>.q|a`). */
export const GUIDE_FAQ_KEYS = ['trial', 'languages', 'cv', 'export', 'calendar', 'support'] as const

/**
 * Topics renamed in the 2026-10 rewrite. Old links (shared with prospects,
 * indexed by search engines) redirect to the topic that now covers them.
 */
export const LEGACY_GUIDE_SLUGS: Readonly<Record<string, string>> = {
  'public-apply-link': 'share-a-vacancy',
  'linkedin-integration': 'share-a-vacancy',
  'manage-candidates': 'add-candidates',
  'pipeline-kanban': 'pipeline',
  'assessments-and-questions': 'assessments-and-scorecards',
}

export function getGuideBySlug(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug)
}

export function getGuidesByCategory(): Record<GuideCategory, GuideMeta[]> {
  const grouped = Object.fromEntries(GUIDE_CATEGORIES.map((c) => [c, [] as GuideMeta[]])) as Record<
    GuideCategory,
    GuideMeta[]
  >
  for (const guide of [...GUIDES].sort((a, b) => a.order - b.order)) {
    grouped[guide.category].push(guide)
  }
  return grouped
}
