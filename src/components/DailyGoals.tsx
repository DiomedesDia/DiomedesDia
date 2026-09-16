import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { DailyGoal } from '../types'
import { todayKey } from '../utils/formatDate'
import { createGoalEvent, deleteCalendarEvent, updateGoalEvent } from '../utils/googleCalendarApi'

interface Props {
  accessToken: string | null
}

export function DailyGoals({ accessToken }: Props) {
  const today = todayKey()
  const [goalsByDay, setGoalsByDay] = useLocalStorage<Record<string, DailyGoal[]>>('daily-goals', {})
  const [draft, setDraft] = useState('')

  const goals = goalsByDay[today] ?? []
  const done = goals.filter((g) => g.done).length

  const setTodayGoals = (updater: (prev: DailyGoal[]) => DailyGoal[]) => {
    setGoalsByDay((prev) => ({ ...prev, [today]: updater(prev[today] ?? []) }))
  }

  const addGoal = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    const id = crypto.randomUUID()
    setTodayGoals((prev) => [...prev, { id, text, done: false }])
    setDraft('')

    if (accessToken) {
      createGoalEvent(accessToken, text, new Date()).then((eventId) => {
        if (!eventId) return
        setTodayGoals((prev) => prev.map((g) => (g.id === id ? { ...g, calendarEventId: eventId } : g)))
      })
    }
  }

  const toggleGoal = (id: string) => {
    const goal = goals.find((g) => g.id === id)
    if (!goal) return
    const nextDone = !goal.done
    setTodayGoals((prev) => prev.map((g) => (g.id === id ? { ...g, done: nextDone } : g)))
    if (accessToken && goal.calendarEventId) {
      updateGoalEvent(accessToken, goal.calendarEventId, goal.text, nextDone)
    }
  }

  const removeGoal = (id: string) => {
    const goal = goals.find((g) => g.id === id)
    setTodayGoals((prev) => prev.filter((g) => g.id !== id))
    if (accessToken && goal?.calendarEventId) {
      deleteCalendarEvent(accessToken, goal.calendarEventId)
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Objetivos de hoy</h2>
        {goals.length > 0 && (
          <span className="muted">
            {done}/{goals.length}
          </span>
        )}
      </div>

      {goals.length > 0 && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(done / goals.length) * 100}%` }} />
        </div>
      )}

      <form className="goal-form" onSubmit={addGoal}>
        <input
          className="text-input"
          type="text"
          placeholder="Ej. Repasar capítulo 3, hacer 20 ejercicios…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn primary" type="submit">
          Agregar
        </button>
      </form>

      <ul className="goals-list">
        {goals.map((goal) => (
          <li key={goal.id} className={goal.done ? 'goal-item done' : 'goal-item'}>
            <label>
              <input type="checkbox" checked={goal.done} onChange={() => toggleGoal(goal.id)} />
              <span>{goal.text}</span>
              {goal.calendarEventId && <span title="Sincronizado con Google Calendar">📅</span>}
            </label>
            <button className="icon-btn" onClick={() => removeGoal(goal.id)} aria-label="Eliminar objetivo">
              ✕
            </button>
          </li>
        ))}
      </ul>

      {goals.length === 0 && <p className="muted">Todavía no agregaste objetivos para hoy.</p>}

      {!accessToken && (
        <p className="muted small-note">
          Conectá tu Google Calendar arriba para que tus objetivos de hoy también aparezcan ahí como eventos.
        </p>
      )}
    </section>
  )
}
