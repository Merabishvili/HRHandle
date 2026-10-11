import { describe, it, expect } from 'vitest'
import { visibleAssessments } from '@/lib/scorecards/visibility'

const rows = [
  { id: 'a1-ana', application_id: 'a1', reviewer_id: 'ana' },
  { id: 'a1-bob', application_id: 'a1', reviewer_id: 'bob' },
  { id: 'a2-bob', application_id: 'a2', reviewer_id: 'bob' },
]
const ids = (list: { id: string }[]) => list.map((r) => r.id)

describe('visibleAssessments', () => {
  it('shows the owner and admins every assessment', () => {
    expect(ids(visibleAssessments(rows, 'zoe', true))).toEqual(['a1-ana', 'a1-bob', 'a2-bob'])
  })

  it('shows a teammate the others only for applications they assessed themselves', () => {
    // Ana assessed a1, so she sees Bob's a1 card — but not his a2 card.
    expect(ids(visibleAssessments(rows, 'ana', false))).toEqual(['a1-ana', 'a1-bob'])
  })

  it('shows a teammate who assessed nothing no one else’s assessment', () => {
    expect(visibleAssessments(rows, 'zoe', false)).toEqual([])
  })
})
