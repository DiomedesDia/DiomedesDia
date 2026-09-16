export interface CalendarEvent {
  id: string
  summary: string
  start: Date
  end: Date
  isAllDay: boolean
  htmlLink?: string
}

export type ReminderOffset = 0 | 5 | 10 | 15 | 30 | 60 | 120

export interface ReminderSettings {
  /** event ids the user opted in/out of, overriding the keyword auto-detect */
  overrides: Record<string, boolean>
  offsetMinutes: ReminderOffset
}

export interface StudySession {
  id: string
  subject: string
  startedAt: number
  durationSeconds: number
}

export interface DailyGoal {
  id: string
  text: string
  done: boolean
  /** id del evento en Google Calendar creado para este objetivo, si el usuario está conectado */
  calendarEventId?: string
}
