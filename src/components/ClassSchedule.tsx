import { useEffect, useRef, useState } from 'react'
import type { ClassScheduleEntry, Weekday } from '../types'
import { createRecurringClassEvent, deleteCalendarEvent } from '../utils/googleCalendarApi'

interface Props {
  accessToken: string | null
  accountEmail: string | null
}

const LEGACY_KEY = 'class-schedule'
const MIGRATION_FLAG = 'class-schedule-migrated-to-account'

function loadSchedule(key: string): ClassScheduleEntry[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as ClassScheduleEntry[]) : []
  } catch {
    return []
  }
}

function saveSchedule(key: string, data: ClassScheduleEntry[]) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // localStorage lleno o no disponible; se ignora
  }
}

/**
 * Carga el horario de una cuenta. La primera vez que una cuenta pide su horario y no tiene
 * nada guardado, hereda una única vez lo que hubiera en la clave vieja sin cuenta (de antes de
 * que el horario se separara por cuenta), para no perder lo que ya estaba sincronizado.
 */
function loadForAccount(email: string | null): ClassScheduleEntry[] {
  if (!email) {
    const legacy = loadSchedule(LEGACY_KEY)
    return legacy.length > 0 ? legacy : DEFAULT_SCHEDULE
  }
  const key = `${LEGACY_KEY}:${email}`
  const existing = loadSchedule(key)
  if (existing.length > 0) return existing
  if (!localStorage.getItem(MIGRATION_FLAG)) {
    const legacy = loadSchedule(LEGACY_KEY)
    if (legacy.length > 0) {
      saveSchedule(key, legacy)
      try {
        localStorage.setItem(MIGRATION_FLAG, '1')
      } catch {
        // se ignora
      }
      return legacy
    }
  }
  return []
}

function storageKeyFor(email: string | null): string {
  return email ? `${LEGACY_KEY}:${email}` : LEGACY_KEY
}

const DAY_LABELS: Record<Weekday, string> = {
  MO: 'Lunes',
  TU: 'Martes',
  WE: 'Miércoles',
  TH: 'Jueves',
  FR: 'Viernes',
  SA: 'Sábado',
  SU: 'Domingo',
}
const DAY_ORDER: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

const DEFAULT_SCHEDULE: ClassScheduleEntry[] = [
  {
    id: 'default-1',
    subject: 'SISTEMAS 4800-10',
    day: 'MO',
    startTime: '11:00',
    endTime: '13:00',
    location: 'Lab 10-4 · José Gabriel Maldonado',
  },
  {
    id: 'default-2',
    subject: 'FORMAC 4300-2',
    day: 'WE',
    startTime: '08:00',
    endTime: '09:00',
    location: 'No necesita salón',
  },
  {
    id: 'default-3',
    subject: 'SISTEMAS 4800-10',
    day: 'WE',
    startTime: '11:00',
    endTime: '13:00',
    location: 'Lab 12-106 · José Gabriel Maldonado',
  },
  {
    id: 'default-4',
    subject: 'SISTEMAS 4800-1',
    day: 'WE',
    startTime: '14:00',
    endTime: '16:00',
    location: 'Lab 12-96B · José Gabriel Maldonado',
  },
  {
    id: 'default-5',
    subject: 'FORMAC 43001-4',
    day: 'TH',
    startTime: '08:00',
    endTime: '09:00',
    location: 'No necesita salón',
  },
  {
    id: 'default-6',
    subject: 'SISTEMAS 4800-1',
    day: 'TH',
    startTime: '11:00',
    endTime: '13:00',
    location: '67-311 · José Rafael Arboleda S.J.',
  },
  {
    id: 'default-7',
    subject: 'SISTEMAS 4800-9',
    day: 'FR',
    startTime: '09:00',
    endTime: '11:00',
    location: '2-023 · Fernando Barón S.J.',
  },
  {
    id: 'default-8',
    subject: 'SISTEMAS 4800-1',
    day: 'FR',
    startTime: '12:00',
    endTime: '14:00',
    location: '2-013 · Fernando Barón S.J.',
  },
]

export function ClassSchedule({ accessToken, accountEmail }: Props) {
  const [classes, setClasses] = useState<ClassScheduleEntry[]>(() => loadForAccount(accountEmail))
  const prevEmailRef = useRef(accountEmail)

  useEffect(() => {
    if (prevEmailRef.current === accountEmail) return
    prevEmailRef.current = accountEmail
    setClasses(loadForAccount(accountEmail))
  }, [accountEmail])

  useEffect(() => {
    saveSchedule(storageKeyFor(accountEmail), classes)
  }, [accountEmail, classes])

  const [syncing, setSyncing] = useState(false)
  const [subject, setSubject] = useState('')
  const [day, setDay] = useState<Weekday>('MO')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [location, setLocation] = useState('')

  const sorted = [...classes].sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime),
  )
  const pendingCount = classes.filter((c) => !c.calendarEventId).length

  const syncOne = async (entry: ClassScheduleEntry) => {
    if (!accessToken) return
    const eventId = await createRecurringClassEvent(accessToken, entry)
    if (eventId) {
      setClasses((prev) => prev.map((c) => (c.id === entry.id ? { ...c, calendarEventId: eventId } : c)))
    }
  }

  const syncAll = async () => {
    if (!accessToken) return
    setSyncing(true)
    for (const entry of classes.filter((c) => !c.calendarEventId)) {
      await syncOne(entry)
    }
    setSyncing(false)
  }

  const addClass = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim()) return
    const entry: ClassScheduleEntry = {
      id: crypto.randomUUID(),
      subject: subject.trim(),
      day,
      startTime,
      endTime,
      location: location.trim() || undefined,
    }
    setClasses((prev) => [...prev, entry])
    setSubject('')
    setLocation('')
    if (accessToken) syncOne(entry)
  }

  const removeClass = (id: string) => {
    const entry = classes.find((c) => c.id === id)
    setClasses((prev) => prev.filter((c) => c.id !== id))
    if (accessToken && entry?.calendarEventId) {
      deleteCalendarEvent(accessToken, entry.calendarEventId)
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Horario semanal</h2>
        {accessToken && pendingCount > 0 && (
          <button className="btn ghost" onClick={syncAll} disabled={syncing}>
            {syncing ? 'Sincronizando…' : `Sincronizar (${pendingCount})`}
          </button>
        )}
      </div>

      <form className="class-form" onSubmit={addClass}>
        <input
          className="text-input"
          type="text"
          placeholder="Materia (ej. SISTEMAS 4800)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <div className="class-form-row">
          <select value={day} onChange={(e) => setDay(e.target.value as Weekday)}>
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAY_LABELS[d]}
              </option>
            ))}
          </select>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <input
          className="text-input"
          type="text"
          placeholder="Lugar / profesor (opcional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <button className="btn primary" type="submit">
          Agregar clase
        </button>
      </form>

      <ul className="class-list">
        {sorted.map((c) => (
          <li key={c.id} className="class-item">
            <div>
              <p className="event-title">{c.subject}</p>
              <p className="event-time">
                {DAY_LABELS[c.day]} · {c.startTime}–{c.endTime}
                {c.location ? ` · ${c.location}` : ''}
              </p>
            </div>
            <div className="class-item-actions">
              {c.calendarEventId ? (
                <span title="Sincronizado con Google Calendar">📅</span>
              ) : (
                accessToken && <span className="muted">sin sincronizar</span>
              )}
              <button className="icon-btn" onClick={() => removeClass(c.id)} aria-label="Eliminar clase">
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!accessToken && (
        <p className="muted small-note">
          Conectá tu Google Calendar arriba y tocá "Sincronizar" para que estas clases se repitan cada semana en tu
          calendario.
        </p>
      )}
    </section>
  )
}
