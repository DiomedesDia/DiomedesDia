import { useEffect, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { ClassScheduleEntry, LinkedAccount, Weekday } from '../types'
import { createRecurringClassEvent, deleteCalendarEvent } from '../utils/googleCalendarApi'

interface Props {
  accounts: LinkedAccount[]
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

/** ¿A cuántas de las cuentas vinculadas les falta esta clase? */
function missingAccounts(entry: ClassScheduleEntry, accounts: LinkedAccount[]): LinkedAccount[] {
  return accounts.filter((a) => !entry.calendarEventIds?.[a.email])
}

export function ClassSchedule({ accounts }: Props) {
  const [classes, setClasses] = useLocalStorage<ClassScheduleEntry[]>('class-schedule', DEFAULT_SCHEDULE)
  const [syncing, setSyncing] = useState(false)
  const [subject, setSubject] = useState('')
  const [day, setDay] = useState<Weekday>('MO')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [location, setLocation] = useState('')

  // Migra clases sincronizadas con versiones viejas de la app (un solo calendarEventId, de
  // cuando todavía no existían varias cuentas vinculadas) al nuevo formato por cuenta,
  // asumiendo que ese id le pertenece a la primera cuenta que se vincule de acá en más.
  useEffect(() => {
    if (accounts.length === 0) return
    setClasses((prev) => {
      let changed = false
      const next = prev.map((c) => {
        const legacyId = (c as unknown as { calendarEventId?: string }).calendarEventId
        if (legacyId && !c.calendarEventIds) {
          changed = true
          const { calendarEventId: _legacy, ...rest } = c as unknown as { calendarEventId?: string } & ClassScheduleEntry
          return { ...rest, calendarEventIds: { [accounts[0].email]: legacyId } }
        }
        return c
      })
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length > 0])

  const sorted = [...classes].sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime),
  )
  const pendingCount = classes.filter((c) => missingAccounts(c, accounts).length > 0).length

  const syncOne = async (entry: ClassScheduleEntry) => {
    const pending = missingAccounts(entry, accounts)
    if (pending.length === 0) return
    const results = await Promise.all(
      pending.map(async (account) => ({ email: account.email, eventId: await createRecurringClassEvent(account.accessToken, entry) })),
    )
    setClasses((prev) =>
      prev.map((c) => {
        if (c.id !== entry.id) return c
        const nextIds = { ...c.calendarEventIds }
        for (const { email, eventId } of results) {
          if (eventId) nextIds[email] = eventId
        }
        return { ...c, calendarEventIds: nextIds }
      }),
    )
  }

  const syncAll = async () => {
    if (accounts.length === 0) return
    setSyncing(true)
    for (const entry of classes.filter((c) => missingAccounts(c, accounts).length > 0)) {
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
    if (accounts.length > 0) syncOne(entry)
  }

  const removeClass = (id: string) => {
    const entry = classes.find((c) => c.id === id)
    setClasses((prev) => prev.filter((c) => c.id !== id))
    if (entry?.calendarEventIds) {
      for (const account of accounts) {
        const eventId = entry.calendarEventIds[account.email]
        if (eventId) deleteCalendarEvent(account.accessToken, eventId)
      }
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Horario semanal</h2>
        {accounts.length > 0 && pendingCount > 0 && (
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
        {sorted.map((c) => {
          const missing = missingAccounts(c, accounts)
          const syncedCount = accounts.length - missing.length
          return (
            <li key={c.id} className="class-item">
              <div>
                <p className="event-title">{c.subject}</p>
                <p className="event-time">
                  {DAY_LABELS[c.day]} · {c.startTime}–{c.endTime}
                  {c.location ? ` · ${c.location}` : ''}
                </p>
              </div>
              <div className="class-item-actions">
                {accounts.length === 0 ? null : syncedCount === 0 ? (
                  <span className="muted">sin sincronizar</span>
                ) : missing.length > 0 ? (
                  <span title="Falta sincronizar con alguna cuenta">
                    📅 {syncedCount}/{accounts.length}
                  </span>
                ) : (
                  <span title="Sincronizado con todas tus cuentas vinculadas">📅</span>
                )}
                <button className="icon-btn" onClick={() => removeClass(c.id)} aria-label="Eliminar clase">
                  ✕
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {accounts.length === 0 && (
        <p className="muted small-note">
          Vinculá al menos una cuenta de Google arriba y tocá "Sincronizar" para que estas clases se repitan cada semana en
          tu calendario.
        </p>
      )}
    </section>
  )
}
