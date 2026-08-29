/**
 * Barrel for the application actions (split from a single 1081-LOC file, A-201).
 * Callers keep importing from '@/lib/actions/applications'; the actions now live
 * in cohesive concern files. Pure re-export module — the `'use server'`
 * directive stays on each concern file where the actions are defined.
 */

export {
  updateApplicationStatus,
  updateApplicationPipelineStage,
  moveApplicationToMainColumn,
  moveApplicationsBatch,
} from './applications/status-actions'
export type { BulkMoveResult } from './applications/status-actions'

export {
  rejectApplication,
  rejectApplicationsBatch,
} from './applications/rejection-actions'

export {
  createApplication,
  withdrawApplicationByToken,
  removeApplication,
} from './applications/lifecycle-actions'
