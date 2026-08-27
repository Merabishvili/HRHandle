// Debounced autosaver for the assessment sheet. Kept UI-agnostic and pure of
// React so the timing logic is unit-testable and so Phase 2 (the stepped
// wizard) can reuse it unchanged — the sheet holds the latest form state in a
// ref and passes a `save` closure that reads it.
//
// Contract:
//   - `schedule()` (re)arms the debounce; the newest call wins.
//   - `flush()` saves immediately IF a save is pending, then disarms. No-op
//     when nothing is pending, so blur / visibilitychange / beforeunload can
//     call it freely without double-saving.
//   - `cancel()` disarms without saving (used on unmount after a flush).

export interface Autosaver {
  schedule: () => void
  flush: () => void
  cancel: () => void
  /** True while a debounced save is armed — handy for a "saving…" indicator. */
  isPending: () => boolean
}

export const DEFAULT_AUTOSAVE_DELAY_MS = 1500

export function createAutosaver(
  save: () => void,
  delayMs: number = DEFAULT_AUTOSAVE_DELAY_MS,
): Autosaver {
  let timer: ReturnType<typeof setTimeout> | null = null

  const cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    schedule() {
      cancel()
      timer = setTimeout(() => {
        timer = null
        save()
      }, delayMs)
    },
    flush() {
      if (timer) {
        cancel()
        save()
      }
    },
    cancel,
    isPending: () => timer !== null,
  }
}
