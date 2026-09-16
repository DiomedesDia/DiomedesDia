import { useEffect, useState } from 'react'
import { useLocalStorage } from './useLocalStorage'
import type { ClassScheduleEntry, LinkedAccount, Weekday } from '../types'
import { createRecurringClassEvent, deleteCalendarEvent, updateRecurringClassEvent } from '../utils/googleCalendarApi'

export const DEFAULT_SCHEDULE: ClassScheduleEntry[] = [
  {
    id: 'default-1',
    subject: 'SISTEMAS 4800-10',
    day: 'MO',
    startTime: '11:00',
    endTime: '13:00',
    location: 'Lab 10-4 · José Gabriel Maldonado',
  },
  {
    id: 'default-2',
    subject: 'FORMAC 4300-2',
    day: 'WE',
    startTime: '08:00',
    endTime: '09:00',
    location: 'No necesita salón',
  },
  {
    id: 'default-3',
    subject: 'SISTEMAS 4800-10',
    day: 'WE',
    startTime: '11:00',
    endTime: '13:00',
    location: 'Lab 12-106 · José Gabriel Maldonado',
  },
  {
    id: 'default-4',
    subject: 'SISTEMAS 4800-1',
    day: 'WE',
    startTime: '14:00',
    endTime: '16:00',
    location: 'Lab 12-96B · José Gabriel Maldonado',
  },
  {
    id: 'default-5',
    subject: 'FORMAC 43001-4',
    day: 'TH',
    startTime: '08:00',
    endTime: '09:00',
    location: 'No necesita salón',
  },
  {
    id: 'default-6',
    subject: 'SISTEMAS 4800-1',
    day: 'TH',
    startTime: '11:00',
    endTime: '13:00',
    location: '67-311 · José Rafael Arboleda S.J.',
  },
  {
    id: 'default-7',
    subject: 'SISTEMAS 4800-9',
    day: 'FR',
    startTime: '09:00',
    endTime: '11:00',
    location: '2-023 · Fernando Barón S.J.',
  },
  {
    id: 'default-8',
    subject: 'SISTEMAS 4800-1',
    day: 'FR',
    startTime: '12:00',
    endTime: '14:00',
    location: '2-013 · Fernando Barón S.J.',
  },
]

/** ¿A cuántas de las cuentas vinculadas les falta esta clase? */
export function missingAccounts(entry: ClassScheduleEntry, accounts: LinkedAccount[]): LinkedAccount[] {
  return accounts.filter((a) => !entry.calendarEventIds?.[a.email])
}

export interface ClassEdits {
  subject?: string
  day?: Weekday
  startTime?: string
  endTime?: string
  location?: string
}

/** Toda la lógica del horario semanal: estado compartido, sincronización y edición. */
export function useClassSchedule(accounts: LinkedAccount[]) {
  const [classes, setClasses] = useLocalStorage<ClassScheduleEntry[]>('class-schedule', DEFAULT_SCHEDULE)
  const [syncing, setSyncing] = useState(false)

  // Migra clases sincronizadas con versiones viejas de la app (un solo calendarEventId, de
  // cuando todavía no existían varias cuentas vinculadas) al nuevo formato por cuenta,
  // asumiendo que ese id le pertenece a la primera cuenta que se vincule de acá en más.
  useEffect(() => {
    if (accounts.length === 0) return
    setClasses((prev) => {
      let changed = false
      const next = prev.map((c) => {
        const legacyId = (c as unknown as { calendarEventId?: string }).calendarEventId
        if (legacyId && !c.calendarEventIds) {
          changed = true
          const { calendarEventId: _legacy, ...rest } = c as unknown as { calendarEventId?: string } & ClassScheduleEntry
          return { ...rest, calendarEventIds: { [accounts[0].email]: legacyId } }
        }
        return c
      })
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length > 0])

  const pendingCount = classes.filter((c) => missingAccounts(c, accounts).length > 0).length
  const hasSyncedSomething = classes.some((c) => Object.keys(c.calendarEventIds ?? {}).length > 0)

  const syncOne = async (entry: ClassScheduleEntry) => {
    const pending = missingAccounts(entry, accounts)
    if (pending.length === 0) return
    const results = await Promise.all(
      pending.map(async (account) => ({ email: account.email, eventId: await createRecurringClassEvent(account.accessToken, entry) })),
    )
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id !== entry.id) return c
        const nextIds = { ...c.calendarEventIds }
        for (const { email, eventId } of results) {
          if (eventId) nextIds[email] = eventId
        }
        return { ...c, calendarEventIds: nextIds }
      }),
    )
  }

  const syncAll = async () => {
    if (accounts.length === 0) return
    setSyncing(true)
    for (const entry of classes.filter((c) => missingAccounts(c, accounts).length > 0)) {
      await syncOne(entry)
    }
    setSyncing(false)
  }

  const addClass = (input: { subject: string; day: Weekday; startTime: string; endTime: string; location?: string }) => {
    const entry: ClassScheduleEntry = {
      id: crypto.randomUUID(),
      subject: input.subject.trim(),
      day: input.day,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location?.trim() || undefined,
    }
    setClasses((prev) => [...prev, entry])
    if (accounts.length > 0) syncOne(entry)
    return entry
  }

  const editClass = async (id: string, edits: ClassEdits) => {
    const current = classes.find((c) => c.id === id)
    if (!current) return false
    const updated: ClassScheduleEntry = {
      ...current,
      subject: edits.subject?.trim() || current.subject,
      day: edits.day ?? current.day,
      startTime: edits.startTime ?? current.startTime,
      endTime: edits.endTime ?? current.endTime,
      location: edits.location !== undefined ? edits.location.trim() || undefined : current.location,
    }
    setClasses((prev) => prev.map((c) => (c.id === id ? updated : c)))

    const syncedEmails = Object.keys(updated.calendarEventIds ?? {})
    if (syncedEmails.length > 0) {
      await Promise.all(
        syncedEmails.map((email) => {
          const account = accounts.find((a) => a.email === email)
          const eventId = updated.calendarEventIds?.[email]
          if (!account || !eventId) return Promise.resolve()
          return updateRecurringClassEvent(account.accessToken, eventId, updated)
        }),
      )
    }
    return true
  }

  const removeClass = (id: string) => {
    const entry = classes.find((c) => c.id === id)
    if (!entry) return false
    setClasses((prev) => prev.filter((c) => c.id !== id))
    if (entry.calendarEventIds) {
      for (const account of accounts) {
        const eventId = entry.calendarEventIds[account.email]
        if (eventId) deleteCalendarEvent(account.accessToken, eventId)
      }
    }
    return true
  }

  /**
   * Olvida qué clases ya estaban sincronizadas (sin borrar nada en Google Calendar), para
   * recuperarse de un horario que quedó desincronizado con la realidad (por ejemplo, después de
   * borrar eventos duplicados a mano). Un "Sincronizar" posterior las vuelve a crear limpias.
   */
  const resyncAll = () => {
    setClasses((prev) => prev.map((c) => ({ ...c, calendarEventIds: {} })))
  }

  return {
    classes,
    syncing,
    pendingCount,
    hasSyncedSomething,
    syncAll,
    addClass,
    editClass,
    removeClass,
    resyncAll,
  }
}

export type ClassScheduleApi = ReturnType<typeof useClassSchedule>
