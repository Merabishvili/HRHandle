import { describe, it, expect } from 'vitest'
import {
  maxStageReached,
  buildFunnel,
  stageConversion,
  FUNNEL_STAGES,
  type ApplicationRecord,
  type StatusChangeRecord,
} from '@/lib/reports/funnel'

describe('maxStageReached', () => {
  it('returns the current status when it is a funnel stage', () => {
    expect(maxStageReached({ id: 'a', current_status: 'interview' }, [])).toBe('interview')
    expect(maxStageReached({ id: 'a', current_status: 'applied' }, [])).toBe('applied')
  })

  it('counts an application currently rejected as still applied if no history', () => {
    expect(maxStageReached({ id: 'a', current_status: 'rejected' }, [])).toBe('applied')
  })

  it('counts highest stage in history even if currently rejected', () => {
    const history: StatusChangeRecord[] = [
      { application_id: 'a', to_status: 'screening' },
      { application_id: 'a', to_status: 'interview' },
      { application_id: 'a', to_status: 'rejected' },
    ]
    expect(maxStageReached({ id: 'a', current_status: 'rejected' }, history)).toBe('interview')
  })

  it('ignores history rows for other applications', () => {
    const history: StatusChangeRecord[] = [
      { application_id: 'other', to_status: 'hired' },
    ]
    expect(maxStageReached({ id: 'a', current_status: 'applied' }, history)).toBe('applied')
  })

  it('returns hired when reached', () => {
    const history: StatusChangeRecord[] = [
      { application_id: 'a', to_status: 'screening' },
      { application_id: 'a', to_status: 'offer' },
      { application_id: 'a', to_status: 'hired' },
    ]
    expect(maxStageReached({ id: 'a', current_status: 'hired' }, history)).toBe('hired')
  })

  it('current=withdrawn with no history → applied', () => {
    expect(maxStageReached({ id: 'a', current_status: 'withdrawn' }, [])).toBe('applied')
  })
})

describe('buildFunnel', () => {
  it('returns zeros for an empty set', () => {
    const f = buildFunnel([], [])
    expect(f).toEqual({
      applied: 0,
      screening: 0,
      interview: 0,
      offer: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0,
      total: 0,
    })
  })

  it('builds a monotonic-decreasing funnel by construction', () => {
    const apps: ApplicationRecord[] = [
      { id: '1', current_status: 'applied' },
      { id: '2', current_status: 'screening' },
      { id: '3', current_status: 'interview' },
      { id: '4', current_status: 'offer' },
      { id: '5', current_status: 'hired' },
    ]
    const f = buildFunnel(apps, [])
    expect(f.applied).toBe(5)
    expect(f.screening).toBe(4)
    expect(f.interview).toBe(3)
    expect(f.offer).toBe(2)
    expect(f.hired).toBe(1)
    expect(f.total).toBe(5)
  })

  it('counts rejected/withdrawn applications by their max reached stage', () => {
    const apps: ApplicationRecord[] = [
      { id: '1', current_status: 'rejected' }, // reached interview
      { id: '2', current_status: 'withdrawn' }, // never moved (applied only)
    ]
    const history: StatusChangeRecord[] = [
      { application_id: '1', to_status: 'screening' },
      { application_id: '1', to_status: 'interview' },
      { application_id: '1', to_status: 'rejected' },
    ]
    const f = buildFunnel(apps, history)
    expect(f.applied).toBe(2)
    expect(f.screening).toBe(1)
    expect(f.interview).toBe(1)
    expect(f.offer).toBe(0)
    expect(f.hired).toBe(0)
    expect(f.rejected).toBe(1)
    expect(f.withdrawn).toBe(1)
    expect(f.total).toBe(2)
  })
})

describe('stageConversion', () => {
  it('returns the rate to/from', () => {
    expect(stageConversion(100, 50)).toBe(0.5)
    expect(stageConversion(10, 2)).toBe(0.2)
  })
  it('returns null when from=0', () => {
    expect(stageConversion(0, 0)).toBe(null)
    expect(stageConversion(0, 5)).toBe(null)
  })
})

describe('FUNNEL_STAGES', () => {
  it('is the canonical 5-stage ordering', () => {
    expect(FUNNEL_STAGES).toEqual(['applied', 'screening', 'interview', 'offer', 'hired'])
  })
})
