'use client'

import { createContext, useContext, useState } from 'react'

import { RejectRemainingDialog } from '@/components/vacancies/reject-remaining-dialog'
import { useCloseVacancy, type CloseRequest } from '@/components/vacancies/use-close-vacancy'

const RequestCloseContext = createContext<(request: CloseRequest) => Promise<void>>(async () => {})

/**
 * Hosts the close/archive question and "Reject remaining candidates" for the
 * Vacancies list — the row menus close (and unmount) on click, so the dialogs
 * live here and the menus ask for them through `useRequestVacancyClose`.
 */
export function CloseVacancyProvider({ children }: { children: React.ReactNode }) {
  const [rejectFor, setRejectFor] = useState<string | null>(null)
  const { requestClose, closeDialog } = useCloseVacancy({ onRejectNext: setRejectFor })
  return (
    <RequestCloseContext.Provider value={requestClose}>
      {children}
      {closeDialog}
      {rejectFor && (
        <RejectRemainingDialog
          vacancyId={rejectFor}
          open
          onOpenChange={(open) => {
            if (!open) setRejectFor(null)
          }}
        />
      )}
    </RequestCloseContext.Provider>
  )
}

export function useRequestVacancyClose() {
  return useContext(RequestCloseContext)
}
