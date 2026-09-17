import { useState } from 'react'
import type { ClassScheduleEntry, LinkedAccount, Weekday } from '../types'
import { missingAccounts, type ClassScheduleApi } from '../hooks/useClassSchedule'

interface Props {
  accounts: LinkedAccount[]
  schedule: ClassScheduleApi
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

export function ClassSchedule({ accounts, schedule }: Props) {
  const { classes, syncing, pendingCount, hasSyncedSomething, syncAll, addClass, editClass, removeClass, resyncAll } = schedule

  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [subject, setSubject] = useState('')
  const [day, setDay] = useState<Weekday>('MO')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [location, setLocation] = useState('')

  const sorted = [...classes].sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime),
  )

  const resetForm = () => {
    setSubject('')
    setDay('MO')
    setStartTime('08:00')
    setEndTime('09:00')
    setLocation('')
  }

  const startEdit = (entry: ClassScheduleEntry) => {
    setEditingId(entry.id)
    setSubject(entry.subject)
    setDay(entry.day)
    setStartTime(entry.startTime)
    setEndTime(entry.endTime)
    setLocation(entry.location ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    resetForm()
  }

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim()) return
    if (editingId) {
      setSavingEdit(true)
      await editClass(editingId, { subject, day, startTime, endTime, location })
      setSavingEdit(false)
      setEditingId(null)
      resetForm()
      return
    }
    addClass({ subject, day, startTime, endTime, location })
    resetForm()
  }

  const handleRemove = (id: string) => {
    removeClass(id)
    if (editingId === id) cancelEdit()
  }

  const handleResyncAll = () => {
    const confirmed = window.confirm(
      'Esto hace que la app "olvide" qué clases ya estaban sincronizadas (no borra nada en tu Google Calendar). ' +
        'Usalo después de borrar a mano los eventos duplicados o viejos en Google Calendar, y después tocá ' +
        '"Sincronizar" para volver a crearlos limpios. ¿Continuar?',
    )
    if (confirmed) resyncAll()
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

      {accounts.length > 0 && hasSyncedSomething && (
        <button className="link-btn resync-all" onClick={handleResyncAll}>
          ¿Tu horario tiene eventos viejos o de más en Google Calendar? Borrá los que sobran a mano ahí y tocá acá para que
          la app vuelva a revisar el estado real de tu calendario (ya no se duplican, aunque toques "Sincronizar" de nuevo).
        </button>
      )}

      <form className="class-form" onSubmit={submitForm}>
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
        <div className="class-form-row">
          <button className="btn primary" type="submit" disabled={savingEdit}>
            {editingId ? (savingEdit ? 'Guardando…' : 'Guardar cambios') : 'Agregar clase'}
          </button>
          {editingId && (
            <button className="btn ghost" type="button" onClick={cancelEdit}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <ul className="class-list">
        {sorted.map((c) => {
          const missing = missingAccounts(c, accounts)
          const syncedCount = accounts.length - missing.length
          return (
            <li key={c.id} className={c.id === editingId ? 'class-item editing' : 'class-item'}>
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
                <button className="icon-btn" onClick={() => startEdit(c)} aria-label="Editar clase">
                  ✎
                </button>
                <button className="icon-btn" onClick={() => handleRemove(c.id)} aria-label="Eliminar clase">
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
