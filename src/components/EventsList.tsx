import { useState } from 'react'
import type { ReminderEntry } from '../hooks/useReminders'
import type { ReminderOffset } from '../types'
import { formatEventTime, todayKey } from '../utils/formatDate'
import { GOAL_PREFIX } from '../utils/googleCalendarApi'

const OFFSET_OPTIONS: ReminderOffset[] = [0, 5, 10, 15, 30, 60, 120]

export interface NewEventInput {
  text: string
  date: string
  time?: string
}

interface Props {
  reminders: ReminderEntry[]
  loading: boolean
  error: string | null
  offsetMinutes: ReminderOffset
  onOffsetChange: (value: ReminderOffset) => void
  onToggleReminder: (eventId: string, enabled: boolean) => void
  onToggleSeries: (summary: string, enabled: boolean) => void
  onRefresh: () => void
  onAddGoal: (input: NewEventInput) => Promise<void>
  onDeleteEvent: (eventId: string) => Promise<void>
}

export function EventsList({
  reminders,
  loading,
  error,
  offsetMinutes,
  onOffsetChange,
  onToggleReminder,
  onToggleSeries,
  onRefresh,
  onAddGoal,
  onDeleteEvent,
}: Props) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayKey())
  const [time, setTime] = useState('')
  const [adding, setAdding] = useState(false)

  const summaryCounts = new Map<string, number>()
  reminders.forEach(({ event }) => summaryCounts.set(event.summary, (summaryCounts.get(event.summary) ?? 0) + 1))
  const shownGroupButton = new Set<string>()

  const submitGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = title.trim()
    if (!text || !date) return
    setAdding(true)
    await onAddGoal({ text, date, time: time || undefined })
    setAdding(false)
    setTitle('')
    setTime('')
    setDate(todayKey())
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Próximos eventos</h2>
        <button className="btn ghost" onClick={onRefresh} disabled={loading}>
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      <form className="add-event-form" onSubmit={submitGoal}>
        <input
          className="text-input"
          type="text"
          placeholder="Título (ej. Entrega de proyecto, parcial de Cálculo, estudiar para el examen…)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={adding}
        />
        <div className="add-event-row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={adding} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={adding} />
          <button className="btn primary" type="submit" disabled={adding}>
            {adding ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
        <p className="muted small-note">Dejá la hora vacía para que quede como evento de todo el día.</p>
      </form>

      <label className="offset-picker">
        Avisarme
        <select value={offsetMinutes} onChange={(e) => onOffsetChange(Number(e.target.value) as ReminderOffset)}>
          {OFFSET_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes === 0 ? 'justo a la hora' : `${minutes} min antes`}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error-text">{error}</p>}
      {!error && reminders.length === 0 && !loading && <p className="muted">No hay eventos próximos en tu calendario.</p>}

      <ul className="events-list">
        {reminders.map(({ event, enabled }) => {
          const groupCount = summaryCounts.get(event.summary) ?? 1
          const showGroupButton = groupCount > 1 && !shownGroupButton.has(event.summary)
          if (showGroupButton) shownGroupButton.add(event.summary)
          const groupAllEnabled = reminders.filter((r) => r.event.summary === event.summary).every((r) => r.enabled)
          const isGoal = event.summary.startsWith(GOAL_PREFIX)

          return (
            <li key={event.id} className={enabled ? 'event-item active' : 'event-item'}>
              <label className="event-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => onToggleReminder(event.id, e.target.checked)}
                />
                <div>
                  <p className="event-title">{event.summary}</p>
                  <p className="event-time">{formatEventTime(event.start, event.isAllDay)}</p>
                  {showGroupButton && (
                    <button
                      className="link-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        onToggleSeries(event.summary, !groupAllEnabled)
                      }}
                    >
                      {groupAllEnabled
                        ? `🔇 silenciar las ${groupCount} repeticiones de "${event.summary}"`
                        : `🔔 activar las ${groupCount} repeticiones de "${event.summary}"`}
                    </button>
                  )}
                </div>
              </label>
              <div className="event-actions">
                {enabled && <span className="badge">🔔 recordatorio activo</span>}
                {isGoal && (
                  <button className="icon-btn" onClick={() => onDeleteEvent(event.id)} aria-label="Eliminar evento">
                    ✕
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
