import { describe, it, expect } from 'vitest'
import type { ApplicationStatus } from '@/lib/types/application'
import {
  filterApplicationsByRole,
  buildCardData,
  groupCardsByStageCode,
  buildTerminalCounts,
  buildClosedCandidates,
  countActiveApplications,
  buildReviewQueue,
  type CrossVacancyApplication,
} from '@/components/pipeline/cross-vacancy-derivation'

function status(id: string, code: string, name = code): ApplicationStatus {
  return { id, code, name } as ApplicationStatus
}

function app(over: Partial<CrossVacancyApplication> & Pick<CrossVacancyApplication, 'id'>): CrossVacancyApplication {
  return {
    candidate_id: 'c-' + over.id,
    status_id: 's-applied',
    first_name: 'Jane',
    last_name: 'Doe',
    email: null,
    current_position: null,
    current_company: null,
    last_status_changed_at: null,
    applied_at: '2026-01-01T00:00:00Z',
    vacancy_id: 'v1',
    vacancy_title: 'Engineer',
    source: null,
    fit_score: null,
    rejection_reason: null,
    ...over,
  }
}

const applied = status('s-applied', 'applied', 'Applied')
const interview = status('s-interview', 'interview', 'Interview')
const rejected = status('s-rejected', 'rejected', 'Rejected')
const withdrawn = status('s-withdrawn', 'withdrawn', 'Withdrawn')
const statusById = new Map([applied, interview, rejected, withdrawn].map((s) => [s.id, s]))

// ─── filterApplicationsByRole ─────────────────────────────────────────────────

describe('filterApplicationsByRole', () => {
  const apps = [app({ id: '1', vacancy_id: 'v1' }), app({ id: '2', vacancy_id: 'v2' })]

  it('returns everything when no role is selected', () => {
    expect(filterApplicationsByRole(apps, [], 2)).toHaveLength(2)
  })
  it('returns everything when all roles are selected', () => {
    expect(filterApplicationsByRole(apps, ['v1', 'v2'], 2)).toHaveLength(2)
  })
  it('filters to the union of selected vacancy ids', () => {
    expect(filterApplicationsByRole(apps, ['v2'], 2).map((a) => a.id)).toEqual(['2'])
  })
})

// ─── buildCardData ────────────────────────────────────────────────────────────

describe('buildCardData', () => {
  it('maps the app onto the card shape with the status code', () => {
    const [card] = buildCardData([app({ id: '1', status_id: 's-interview' })], statusById, [applied])
    expect(card).toMatchObject({ applicationId: '1', candidateId: 'c-1', stageCode: 'interview' })
  })
  it('falls back to the first active status code when the app has no status', () => {
    const [card] = buildCardData([app({ id: '1', status_id: null })], statusById, [applied])
    expect(card?.stageCode).toBe('applied')
  })
  it('uses last_status_changed_at for inStageSince when present, else applied_at', () => {
    const [c1] = buildCardData([app({ id: '1', last_status_changed_at: '2026-02-02T00:00:00Z' })], statusById, [applied])
    expect(c1?.inStageSince).toBe('2026-02-02T00:00:00Z')
    const [c2] = buildCardData([app({ id: '2', last_status_changed_at: null })], statusById, [applied])
    expect(c2?.inStageSince).toBe('2026-01-01T00:00:00Z')
  })
})

// ─── groupCardsByStageCode ────────────────────────────────────────────────────

describe('groupCardsByStageCode', () => {
  it('buckets cards by stage code preserving order', () => {
    const cards = buildCardData(
      [app({ id: '1', status_id: 's-applied' }), app({ id: '2', status_id: 's-interview' }), app({ id: '3', status_id: 's-applied' })],
      statusById,
      [applied],
    )
    const grouped = groupCardsByStageCode(cards)
    expect(grouped.get('applied')?.map((c) => c.applicationId)).toEqual(['1', '3'])
    expect(grouped.get('interview')?.map((c) => c.applicationId)).toEqual(['2'])
  })
})

// ─── buildTerminalCounts ──────────────────────────────────────────────────────

describe('buildTerminalCounts', () => {
  it('counts applications per terminal status', () => {
    const apps = [app({ id: '1', status_id: 's-rejected' }), app({ id: '2', status_id: 's-rejected' }), app({ id: '3', status_id: 's-withdrawn' })]
    const counts = buildTerminalCounts([rejected, withdrawn], apps)
    expect(counts.find((c) => c.code === 'rejected')?.count).toBe(2)
    expect(counts.find((c) => c.code === 'withdrawn')?.count).toBe(1)
  })
})

// ─── buildClosedCandidates ────────────────────────────────────────────────────

describe('buildClosedCandidates', () => {
  it('includes only rejected/withdrawn apps with their reason', () => {
    const apps = [
      app({ id: '1', status_id: 's-applied' }),
      app({ id: '2', status_id: 's-rejected', rejection_reason: 'Not a fit' }),
      app({ id: '3', status_id: 's-withdrawn' }),
    ]
    const closed = buildClosedCandidates(apps, statusById)
    expect(closed.map((c) => c.applicationId)).toEqual(['2', '3'])
    expect(closed[0]).toMatchObject({ code: 'rejected', reason: 'Not a fit' })
  })
})

// ─── countActiveApplications ──────────────────────────────────────────────────

describe('countActiveApplications', () => {
  it('counts only non-terminal applications', () => {
    const apps = [
      app({ id: '1', status_id: 's-applied' }),
      app({ id: '2', status_id: 's-interview' }),
      app({ id: '3', status_id: 's-rejected' }),
      app({ id: '4', status_id: 's-withdrawn' }),
    ]
    expect(countActiveApplications(apps, statusById)).toBe(2)
  })
})

// ─── buildReviewQueue ─────────────────────────────────────────────────────────

describe('buildReviewQueue', () => {
  it('keeps only untouched non-terminal apps, oldest first', () => {
    const apps = [
      app({ id: 'new-b', status_id: 's-applied', last_status_changed_at: null, applied_at: '2026-01-05T00:00:00Z' }),
      app({ id: 'touched', status_id: 's-applied', last_status_changed_at: '2026-01-06T00:00:00Z' }),
      app({ id: 'new-a', status_id: 's-applied', last_status_changed_at: null, applied_at: '2026-01-01T00:00:00Z' }),
      app({ id: 'rejected', status_id: 's-rejected', last_status_changed_at: null }),
    ]
    expect(buildReviewQueue(apps, statusById).map((a) => a.id)).toEqual(['new-a', 'new-b'])
  })
})
