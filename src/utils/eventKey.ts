import type { CalendarEvent } from '../types'

/** Clave única para un evento entre todas las cuentas vinculadas (el id de Google solo es único por cuenta). */
export function eventKey(event: CalendarEvent): string {
  return `${event.accountEmail}::${event.id}`
}
