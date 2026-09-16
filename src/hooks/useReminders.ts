import { useEffect, useRef, useState } from 'react'
import type { CalendarEvent, ReminderOffset } from '../types'
import { looksLikeStudyEvent } from '../utils/studyKeywords'
import { playAlarmSound, showAlarmNotification } from '../utils/alarm'
import { eventKey } from '../utils/eventKey'

export interface ReminderEntry {
  event: CalendarEvent
  enabled: boolean
}

export interface FiredAlarm {
  key: string
  summary: string
}

/**
 * Agenda alarmas locales (con setTimeout) para los eventos marcados como recordatorio.
 * Solo funciona mientras la pestaña sigue abierta: no hay backend que empuje notificaciones.
 */
export function useReminders(events: CalendarEvent[], offsetMinutes: ReminderOffset, overrides: Record<string, boolean>) {
  const [firedAlarms, setFiredAlarms] = useState<FiredAlarm[]>([])
  const timeoutsRef = useRef<number[]>([])

  const reminders: ReminderEntry[] = events.map((event) => ({
    event,
    enabled: overrides[eventKey(event)] ?? looksLikeStudyEvent(event.summary),
  }))

  useEffect(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id))
    timeoutsRef.current = []

    const now = Date.now()
    reminders
      .filter((r) => r.enabled && !r.event.isAllDay)
      .forEach(({ event }) => {
        const triggerAt = event.start.getTime() - offsetMinutes * 60 * 1000
        const delay = triggerAt - now
        if (delay <= 0 || delay > 2 ** 31 - 1) return
        const id = window.setTimeout(() => {
          playAlarmSound()
          showAlarmNotification('⏰ Hora de estudiar', event.summary)
          setFiredAlarms((prev) => [...prev, { key: eventKey(event), summary: event.summary }])
        }, delay)
        timeoutsRef.current.push(id)
      })

    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, offsetMinutes, overrides])

  const dismissAlarm = (key: string) => {
    setFiredAlarms((prev) => prev.filter((a) => a.key !== key))
  }

  return { reminders, firedAlarms, dismissAlarm }
}
