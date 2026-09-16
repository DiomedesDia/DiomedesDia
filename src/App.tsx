import { useEffect } from 'react'
import { useGoogleAuth } from './hooks/useGoogleAuth'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { useReminders } from './hooks/useReminders'
import { useLocalStorage } from './hooks/useLocalStorage'
import { LoginButton } from './components/LoginButton'
import { EventsList } from './components/EventsList'
import { AlarmBanner } from './components/AlarmBanner'
import { StudyTimer } from './components/StudyTimer'
import { ClassSchedule } from './components/ClassSchedule'
import { requestNotificationPermission } from './utils/alarm'
import { createGoalEvent, deleteCalendarEvent } from './utils/googleCalendarApi'
import type { ReminderOffset } from './types'

export default function App() {
  const auth = useGoogleAuth()
  const { events, loading, error, refresh } = useCalendarEvents(auth.accessToken)
  const [offsetMinutes, setOffsetMinutes] = useLocalStorage<ReminderOffset>('reminder-offset', 15)
  const [overrides, setOverrides] = useLocalStorage<Record<string, boolean>>('reminder-overrides', {})
  const { reminders, firedAlarms, dismissAlarm } = useReminders(events, offsetMinutes, overrides)

  useEffect(() => {
    if (auth.isSignedIn) requestNotificationPermission()
  }, [auth.isSignedIn])

  return (
    <div className="app">
      <AlarmBanner alarms={firedAlarms} onDismiss={dismissAlarm} />

      <header className="app-header">
        <h1>📚 Study Buddy</h1>
        <p className="muted">Tu calendario, tus recordatorios de estudio y tu cronómetro, todo en un lugar.</p>
      </header>

      <LoginButton
        isConfigured={auth.isConfigured}
        isSignedIn={auth.isSignedIn}
        error={auth.error}
        onSignIn={() => auth.signIn(true)}
        onSignOut={auth.signOut}
      />

      <main className="layout">
        <div className="column">
          {auth.isSignedIn ? (
            <EventsList
              reminders={reminders}
              loading={loading}
              error={error}
              offsetMinutes={offsetMinutes}
              onOffsetChange={setOffsetMinutes}
              onToggleReminder={(eventId, enabled) => setOverrides((prev) => ({ ...prev, [eventId]: enabled }))}
              onToggleSeries={(summary, enabled) =>
                setOverrides((prev) => {
                  const next = { ...prev }
                  events.filter((e) => e.summary === summary).forEach((e) => {
                    next[e.id] = enabled
                  })
                  return next
                })
              }
              onRefresh={refresh}
              onAddGoal={async (text) => {
                if (!auth.accessToken) return
                await createGoalEvent(auth.accessToken, text, new Date())
                await refresh()
              }}
              onDeleteEvent={async (eventId) => {
                if (!auth.accessToken) return
                await deleteCalendarEvent(auth.accessToken, eventId)
                await refresh()
              }}
            />
          ) : (
            auth.isConfigured && (
              <div className="card">
                <p className="muted">Conecta tu cuenta de Google para ver tus eventos, agregar objetivos y activar los recordatorios.</p>
              </div>
            )
          )}
          <ClassSchedule accessToken={auth.accessToken} />
        </div>

        <div className="column">
          <StudyTimer />
        </div>
      </main>

      <footer className="app-footer">
        <p className="muted">
          Los recordatorios suenan mientras esta pestaña esté abierta en tu navegador. Los objetivos y el horario se guardan
          como eventos reales en tu Google Calendar; el cronómetro se guarda solo en este dispositivo.
        </p>
      </footer>
    </div>
  )
}
