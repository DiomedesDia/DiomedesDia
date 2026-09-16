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

export const GOAL_PREFIX = '📌 '

function combineLocal(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const combined = new Date(date)
  combined.setHours(hours, minutes, 0, 0)
  return combined
}

function toRfc3339Local(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${dateOnly(date)}T${hh}:${mm}:00`
}

interface NewEventInput {
  summary: string
  /** día del evento (se usa la parte de fecha, en hora local) */
  date: Date
  /** hora "HH:MM"; si no se pasa, el evento se crea como "todo el día" */
  time?: string
}

/**
 * Crea un evento (objetivo, entrega, parcial, etc.) en la fecha indicada, para que aparezca
 * mezclado con el resto de los eventos del calendario. Devuelve el id del evento o null si falló.
 * Sin hora, se crea como "todo el día" (end.date = start.date + 1, porque el rango es exclusivo).
 * Con hora, dura 1 hora por defecto.
 */
export async function createEvent(accessToken: string, input: NewEventInput): Promise<string | null> {
  try {
    const body: Record<string, unknown> = { summary: `${GOAL_PREFIX}${input.summary}` }

    if (input.time) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const start = combineLocal(input.date, input.time)
      const end = new Date(start)
      end.setHours(end.getHours() + 1)
      body.start = { dateTime: toRfc3339Local(start), timeZone }
      body.end = { dateTime: toRfc3339Local(end), timeZone }
    } else {
      const day = dateOnly(input.date)
      body.start = { date: day }
      body.end = { date: addDays(day, 1) }
    }

    const res = await fetch(EVENTS_BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

interface ClassEventInput {
  subject: string
  day: Weekday
  startTime: string
  endTime: string
  location?: string
}

function recurringClassEventBody(entry: ClassEventInput) {
  const date = nextDateForWeekday(entry.day)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return {
    summary: entry.subject,
    location: entry.location,
    start: { dateTime: toRfc3339Local(combineLocal(date, entry.startTime)), timeZone },
    end: { dateTime: toRfc3339Local(combineLocal(date, entry.endTime)), timeZone },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${entry.day}`],
  }
}

/** Crea un evento que se repite cada semana el mismo día/horario (para el horario de clases). */
export async function createRecurringClassEvent(accessToken: string, entry: ClassEventInput): Promise<string | null> {
  try {
    const res = await fetch(EVENTS_BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(recurringClassEventBody(entry)),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: string }
    return data.id ?? null
  } catch {
    return null
  }
}

/**
 * Actualiza un evento recurrente de clase ya sincronizado (materia, día, horario o lugar).
 * Reemplaza el día/hora de todas las repeticiones futuras, así sirve tanto para corregir un
 * dato como para mover la clase a otro horario de forma permanente.
 */
export async function updateRecurringClassEvent(accessToken: string, eventId: string, entry: ClassEventInput): Promise<boolean> {
  try {
    const res = await fetch(`${EVENTS_BASE}/${eventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(recurringClassEventBody(entry)),
    })
    return res.ok
  } catch {
    return false
  }
}
