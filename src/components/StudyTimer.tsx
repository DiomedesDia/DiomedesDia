import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { StudySession } from '../types'
import { formatDuration, todayKey } from '../utils/formatDate'

export function StudyTimer() {
  const [sessions, setSessions] = useLocalStorage<StudySession[]>('study-sessions', [])
  const [subject, setSubject] = useState('')
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        if (startRef.current !== null) {
          setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
        }
      }, 1000)
    }
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    }
  }, [running])

  const start = () => {
    startRef.current = Date.now() - elapsed * 1000
    setRunning(true)
  }

  const pause = () => {
    setRunning(false)
  }

  const finish = () => {
    setRunning(false)
    if (elapsed > 0) {
      setSessions((prev) => [
        { id: crypto.randomUUID(), subject: subject.trim() || 'Sin materia', startedAt: Date.now(), durationSeconds: elapsed },
        ...prev,
      ])
    }
    setElapsed(0)
    startRef.current = null
  }

  const today = todayKey()
  const todaysSessions = sessions.filter((s) => todayKey(new Date(s.startedAt)) === today)
  const todaysTotal = todaysSessions.reduce((sum, s) => sum + s.durationSeconds, 0)

  return (
    <section className="card">
      <h2>Cronómetro de estudio</h2>

      <input
        className="text-input"
        type="text"
        placeholder="¿Qué estás estudiando? (ej. Cálculo II)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        disabled={running}
      />

      <p className="timer-display">{formatDuration(elapsed)}</p>

      <div className="timer-controls">
        {!running ? (
          <button className="btn primary" onClick={start}>
            {elapsed > 0 ? 'Reanudar' : 'Iniciar'}
          </button>
        ) : (
          <button className="btn secondary" onClick={pause}>
            Pausar
          </button>
        )}
        <button className="btn ghost" onClick={finish} disabled={elapsed === 0}>
          Terminar y guardar
        </button>
      </div>

      <p className="muted">Hoy estudiaste: {formatDuration(todaysTotal)}</p>

      {todaysSessions.length > 0 && (
        <ul className="session-list">
          {todaysSessions.map((s) => (
            <li key={s.id}>
              <span>{s.subject}</span>
              <span>{formatDuration(s.durationSeconds)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
