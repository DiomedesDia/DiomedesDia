import { useCallback, useEffect, useState } from 'react'
import type { CalendarEvent, LinkedAccount } from '../types'

interface GoogleApiEvent {
  id: string
  summary?: string
  htmlLink?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

function parseEvent(raw: GoogleApiEvent, accountEmail: string): CalendarEvent | null {
  const startRaw = raw.start?.dateTime ?? raw.start?.date
  const endRaw = raw.end?.dateTime ?? raw.end?.date
  if (!startRaw || !endRaw) return null
  return {
    id: raw.id,
    summary: raw.summary ?? '(sin título)',
    start: new Date(startRaw),
    end: new Date(endRaw),
    isAllDay: !raw.start?.dateTime,
    htmlLink: raw.htmlLink,
    accountEmail,
  }
}

async function fetchEventsForAccount(account: LinkedAccount, daysAhead: number): Promise<CalendarEvent[]> {
  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString()
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  })
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${account.accessToken}` },
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error(`La sesión con ${account.email} expiró, volvé a vincular esa cuenta.`)
    throw new Error(`Error de Google Calendar (${res.status}) en ${account.email}`)
  }
  const data = (await res.json()) as { items?: GoogleApiEvent[] }
  return (data.items ?? [])
    .map((item) => parseEvent(item, account.email))
    .filter((e): e is CalendarEvent => e !== null)
}

/** Trae los próximos eventos de todas las cuentas vinculadas y los combina en una sola lista. */
export function useCalendarEvents(accounts: LinkedAccount[], daysAhead = 14) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (accounts.length === 0) {
      setEvents([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.allSettled(accounts.map((account) => fetchEventsForAccount(account, daysAhead)))
      const merged = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failures.length > 0) {
        setError(failures.map((f) => (f.reason instanceof Error ? f.reason.message : 'Error desconocido')).join(' · '))
      }
      merged.sort((a, b) => a.start.getTime() - b.start.getTime())
      setEvents(merged)
    } finally {
      setLoading(false)
    }
  }, [accounts, daysAhead])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { events, loading, error, refresh }
}
