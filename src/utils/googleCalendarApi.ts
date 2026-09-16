import type { Weekday } from '../types'

const EVENTS_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

/** Fecha en formato yyyy-mm-dd usando el día LOCAL (evita el corrimiento de día que da toISOString con UTC). */
function dateOnly(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return dateOnly(new Date(y, m - 1, d + days))
}

export const GOAL_PREFIX = '🎯 '

/**
 * Crea un evento de día completo para un objetivo diario, para que aparezca mezclado con el
 * resto de los eventos del día. Devuelve el id del evento o null si falló.
 * Para eventos de "todo el día" Google Calendar espera end.date = start.date + 1 día (el rango es exclusivo).
 */
export async function createGoalEvent(accessToken: string, text: string, date: Date): Promise<string | null> {
  try {
    const day = dateOnly(date)
    const res = await fetch(EVENTS_BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `${GOAL_PREFIX}${text}`,
        start: { date: day },
        end: { date: addDays(day, 1) },
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: string }
    return data.id ?? null
  } catch {
    return null
  }
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  try {
    await fetch(`${EVENTS_BASE}/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    // se ignora: si el evento ya no existe o falla la red, no hay nada más que hacer
  }
}

const WEEKDAY_INDEX: Record<Weekday, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

function nextDateForWeekday(day: Weekday): Date {
  const today = new Date()
  const diff = (WEEKDAY_INDEX[day] - today.getDay() + 7) % 7
  const result = new Date(today)
  result.setDate(today.getDate() + diff)
  return result
}

function localDateTime(date: Date, time: string): string {
  const [hours, minutes] = time.split(':')
  return `${dateOnly(date)}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`
}

interface ClassEventInput {
  subject: string
  day: Weekday
  startTime: string
  endTime: string
  location?: string
}

/** Crea un evento que se repite cada semana el mismo día/horario (para el horario de clases). */
export async function createRecurringClassEvent(accessToken: string, entry: ClassEventInput): Promise<string | null> {
  try {
    const date = nextDateForWeekday(entry.day)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const res = await fetch(EVENTS_BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: entry.subject,
        location: entry.location,
        start: { dateTime: localDateTime(date, entry.startTime), timeZone },
        end: { dateTime: localDateTime(date, entry.endTime), timeZone },
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${entry.day}`],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: string }
    return data.id ?? null
  } catch {
    return null
  }
}
