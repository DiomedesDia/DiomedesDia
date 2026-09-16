import { useCallback, useEffect, useState } from 'react'
import type { CalendarEvent } from '../types'

interface GoogleApiEvent {
  id: string
  summary?: string
  htmlLink?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

function parseEvent(raw: GoogleApiEvent): CalendarEvent | null {
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
  }
}

/** Trae los próximos eventos del calendario principal del usuario. */
export function useCalendarEvents(accessToken: string | null, daysAhead = 14) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
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
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        if (res.status === 401) throw new Error('La sesión con Google expiró, inicia sesión de nuevo.')
        throw new Error(`Error de Google Calendar (${res.status})`)
      }
      const data = (await res.json()) as { items?: GoogleApiEvent[] }
      const parsed = (data.items ?? [])
        .map(parseEvent)
        .filter((e): e is CalendarEvent => e !== null)
        .sort((a, b) => a.start.getTime() - b.start.getTime())
      setEvents(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los eventos.')
    } finally {
      setLoading(false)
    }
  }, [accessToken, daysAhead])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { events, loading, error, refresh }
}
