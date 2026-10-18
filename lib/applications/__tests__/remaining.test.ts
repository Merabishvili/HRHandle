import { describe, it, expect } from 'vitest'
import { countByStage, splitRemaining, type RemainingApplicationRow } from '@/lib/applications/remaining'

const stage = (name: string, type: 'standard' | 'review' | 'interview' | 'offer', sort_order: number, is_terminal = false) => ({
  name,
  type,
  sort_order,
  is_terminal,
})
const row = (id: string, name: string, s: RemainingApplicationRow['stage'], email: string | null = `${id}@x.ge`): RemainingApplicationRow => ({
  applicationId: id,
  candidateId: `c-${id}`,
  candidateName: name,
  email,
  stage: s,
})

describe('splitRemaining', () => {
  const rows = [
    row('1', 'Zura', stage('Interview', 'interview', 3)),
    row('2', 'Ana', stage('Applied', 'standard', 1)),
    row('3', 'Beka', stage('Screening', 'review', 2), null),
    row('4', 'Nino', stage('Offer', 'offer', 4)),
    row('5', 'Gio', stage('Hired', 'standard', 5, true)),
    row('6', 'Lela', stage('Rejected', 'standard', 6, true)),
    row('7', 'Mari', stage('Withdrawn', 'standard', 7, true)),
    row('8', 'Dato', stage('Applied', 'standard', 1)),
  ]

  it('rejects only candidates still in progress, in board order', () => {
    const { toReject } = splitRemaining(rows)
    expect(toReject.map((c) => c.candidateName)).toEqual(['Ana', 'Dato', 'Beka', 'Zura'])
    expect(toReject.map((c) => c.bucket)).toEqual(['applied', 'applied', 'screening', 'interview'])
  })

  it('lists Offer-stage candidates separately and never touches hired, rejected or withdrawn ones', () => {
    const { toReject, atOffer } = splitRemaining(rows)
    expect(atOffer.map((c) => c.candidateName)).toEqual(['Nino'])
    const all = [...toReject, ...atOffer].map((c) => c.candidateName)
    expect(all).not.toContain('Gio')
    expect(all).not.toContain('Lela')
    expect(all).not.toContain('Mari')
  })

  it('knows who has no email address', () => {
    const { toReject } = splitRemaining(rows)
    expect(toReject.find((c) => c.candidateName === 'Beka')?.hasEmail).toBe(false)
    expect(toReject.find((c) => c.candidateName === 'Ana')?.hasEmail).toBe(true)
  })

  it('treats a legacy application without a stage as Applied', () => {
    expect(splitRemaining([row('9', 'Old', null)]).toReject[0]?.bucket).toBe('applied')
  })
})

describe('countByStage', () => {
  it('counts per stage in the order given', () => {
    const { toReject } = splitRemaining([
      row('1', 'A', stage('Applied', 'standard', 1)),
      row('2', 'B', stage('Applied', 'standard', 1)),
      row('3', 'C', stage('Interview', 'interview', 3)),
    ])
    expect(countByStage(toReject)).toEqual([
      { stageName: 'Applied', count: 2 },
      { stageName: 'Interview', count: 1 },
    ])
  })
})
