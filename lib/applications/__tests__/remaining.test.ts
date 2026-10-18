import { describe, it, expect } from 'vitest'
import {
  applicationsToReject,
  defaultStageKeys,
  groupRemainingByStage,
  remainingTotal,
  type RemainingApplicationRow,
} from '@/lib/applications/remaining'

type StageType = 'standard' | 'review' | 'interview' | 'offer'
const stage = (name: string, type: StageType, sort_order: number, is_terminal = false) => ({ name, type, sort_order, is_terminal })
const row = (
  id: string,
  name: string,
  stageId: string | null,
  s: RemainingApplicationRow['stage'],
  email: string | null = `${id}@x.ge`,
): RemainingApplicationRow => ({ applicationId: id, candidateId: `c-${id}`, candidateName: name, email, stageId, stage: s })

const ROWS = [
  row('1', 'Zura', 'st-int', stage('Interview', 'interview', 3)),
  row('2', 'Ana', 'st-app', stage('Applied', 'standard', 1)),
  row('3', 'Beka', 'st-scr', stage('Screening', 'review', 2), null),
  row('4', 'Nino', 'st-off', stage('Offer', 'offer', 5)),
  row('5', 'Gio', 'st-hired', stage('Hired', 'standard', 6, true)),
  row('6', 'Lela', 'st-rej', stage('Rejected', 'standard', 7, true)),
  row('7', 'Mari', 'st-wd', stage('Withdrawn', 'standard', 8, true)),
  row('8', 'Dato', 'st-app', stage('Applied', 'standard', 1)),
  row('9', 'Tako', 'st-tech', stage('Technical task', 'review', 4)),
]

describe('groupRemainingByStage', () => {
  it('groups candidates still in progress by stage, in board order, custom stages included', () => {
    const stages = groupRemainingByStage(ROWS)
    expect(stages.map((s) => [s.name, s.candidates.map((c) => c.candidateName)])).toEqual([
      ['Applied', ['Ana', 'Dato']],
      ['Screening', ['Beka']],
      ['Interview', ['Zura']],
      ['Technical task', ['Tako']],
      ['Offer', ['Nino']],
    ])
  })

  it('leaves hired, rejected and withdrawn candidates out', () => {
    const names = groupRemainingByStage(ROWS).flatMap((s) => s.candidates.map((c) => c.candidateName))
    expect(names).not.toEqual(expect.arrayContaining(['Gio']))
    expect(names).not.toContain('Lela')
    expect(names).not.toContain('Mari')
  })

  it('marks the Offer stage, and who has no email address', () => {
    const stages = groupRemainingByStage(ROWS)
    expect(stages.find((s) => s.name === 'Offer')?.isOffer).toBe(true)
    expect(stages.find((s) => s.name === 'Screening')?.candidates[0]?.hasEmail).toBe(false)
  })

  it('puts a legacy application without a stage first, as Applied', () => {
    const [first] = groupRemainingByStage([row('x', 'Old', null, null), ...ROWS])
    expect(first).toMatchObject({ key: 'none', bucket: 'applied' })
  })
})

describe('choosing who to reject', () => {
  const stages = groupRemainingByStage(ROWS)

  it('ticks every stage except Offer at first', () => {
    expect(defaultStageKeys(stages)).toEqual(['st-app', 'st-scr', 'st-int', 'st-tech'])
    expect(remainingTotal(stages)).toBe(6)
  })

  it('rejects the ticked stages minus the exceptions', () => {
    expect(applicationsToReject(stages, defaultStageKeys(stages), ['1'])).toEqual(['2', '8', '3', '9'])
  })

  it('includes the Offer stage only when it is ticked', () => {
    expect(applicationsToReject(stages, ['st-off'], [])).toEqual(['4'])
  })
})
