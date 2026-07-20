/**
 * Barrel for the offer actions (split from a single 771-LOC file, A-201).
 * Recruiter-side management vs candidate-side token flows. Callers keep
 * importing from '@/lib/actions/offers'. Pure re-export — `'use server'`
 * lives on each concern file.
 */

export {
  createOffer,
  updateOffer,
  sendOffer,
  withdrawOffer,
  deleteOffer,
} from './offers/offer-management'
export type { OfferInput } from './offers/offer-management'

export {
  getOfferByToken,
  acceptOfferByToken,
  declineOfferByToken,
} from './offers/offer-token'
