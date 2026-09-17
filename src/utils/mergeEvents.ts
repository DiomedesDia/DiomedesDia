import type { CalendarEvent } from '../types'
import { GOAL_PREFIX } from './googleCalendarApi'

export interface MergedEvent {
  key: string
  event: CalendarEvent
  isGoal: boolean
  members: CalendarEvent[]
  accountEmails: string[]
}

/** Junta en una sola entrada los eventos que son "lo mismo" (mismo título y horario) en varias cuentas vinculadas. */
export function mergeEventsAcrossAccounts(events: CalendarEvent[]): MergedEvent[] {
  const groups = new Map<string, MergedEvent>()
  for (const event of events) {
    const groupKey = `${event.summary}||${event.start.getTime()}||${event.isAllDay}`
    const existing = groups.get(groupKey)
    if (existing) {
      existing.members.push(event)
      if (!existing.accountEmails.includes(event.accountEmail)) existing.accountEmails.push(event.accountEmail)
    } else {
      groups.set(groupKey, {
        key: groupKey,
        event,
        isGoal: event.summary.startsWith(GOAL_PREFIX),
        members: [event],
        accountEmails: [event.accountEmail],
      })
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.event.start.getTime() - b.event.start.getTime())
}
