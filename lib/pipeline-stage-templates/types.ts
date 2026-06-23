/**
 * Shared types for the A-5 org-level pipeline-stage templates. Lives
 * outside the 'use server' action file so test files + client
 * components can import the types without pulling in server-only deps.
 */

export type PipelineStageType = 'standard' | 'interview' | 'offer' | 'review'

export interface OrgPipelineStageTemplate {
  id: string
  name: string
  type: PipelineStageType
  sort_order: number
  is_terminal: boolean
}

export const PIPELINE_STAGE_TYPES: PipelineStageType[] = [
  'standard',
  'interview',
  'offer',
  'review',
]
