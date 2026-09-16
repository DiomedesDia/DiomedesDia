import type { ReminderEntry } from '../hooks/useReminders'
import type { ReminderOffset } from '../types'
import { formatEventTime } from '../utils/formatDate'

const OFFSET_OPTIONS: ReminderOffset[] = [0, 5, 10, 15, 30, 60, 120]

interface Props {
  reminders: ReminderEntry[]
  loading: boolean
  error: string | null
  offsetMinutes: ReminderOffset
  onOffsetChange: (value: ReminderOffset) => void
  onToggleReminder: (eventId: string, enabled: boolean) => void
  onRefresh: () => void
}

export function EventsList({ reminders, loading, error, offsetMinutes, onOffsetChange, onToggleReminder, onRefresh }: Props) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>Próximos eventos</h2>
        <button className="btn ghost" onClick={onRefresh} disabled={loading}>
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

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
        {reminders.map(({ event, enabled }) => (
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
              </div>
            </label>
            {enabled && <span className="badge">🔔 recordatorio activo</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
