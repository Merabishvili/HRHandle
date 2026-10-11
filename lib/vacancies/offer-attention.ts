/**
 * What the vacancy's "Needs your attention" list says about each candidate at
 * the Offer stage, decided from their actual offers (not just the stage):
 *  - an offer was sent and the candidate hasn't answered → "awaiting reply",
 *    counting days since it was sent;
 *  - an offer was accepted → nothing (the profile shows "Mark as Hired");
 *  - only a draft → "still a draft — send it";
 *  - no live offer (none yet, or the last one was declined / withdrawn /
 *    expired) → "no offer sent yet — create one".
 */
export interface OfferStageOffer {
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'withdrawn' | string
  sent_at: string | null
}

export type OfferAttention =
  | { kind: 'awaiting'; daysAwaiting: number }
  | { kind: 'draft' }
  | { kind: 'none' }
  | null

const DAY_MS = 24 * 60 * 60 * 1000

export function offerAttention(offers: OfferStageOffer[], now: number = Date.now()): OfferAttention {
  const sent = offers
    .filter((o) => o.status === 'sent')
    .sort((a, b) => Date.parse(b.sent_at ?? '') - Date.parse(a.sent_at ?? ''))[0]
  if (sent) {
    const since = sent.sent_at ? Date.parse(sent.sent_at) : now
    return { kind: 'awaiting', daysAwaiting: Math.max(0, Math.floor((now - since) / DAY_MS)) }
  }
  if (offers.some((o) => o.status === 'accepted')) return null
  if (offers.some((o) => o.status === 'draft')) return { kind: 'draft' }
  return { kind: 'none' }
}
