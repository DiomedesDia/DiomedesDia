import { useEffect } from 'react'
import { useGoogleAccounts } from './hooks/useGoogleAccounts'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { useReminders } from './hooks/useReminders'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useClassSchedule } from './hooks/useClassSchedule'
import { useAgentChat } from './hooks/useAgentChat'
import { LoginButton } from './components/LoginButton'
import { EventsList } from './components/EventsList'
import { AlarmBanner } from './components/AlarmBanner'
import { StudyTimer } from './components/StudyTimer'
import { ClassSchedule } from './components/ClassSchedule'
import { AgentChat } from './components/AgentChat'
import { requestNotificationPermission } from './utils/alarm'
import { createEvent, deleteCalendarEvent } from './utils/googleCalendarApi'
import { eventKey } from './utils/eventKey'
import type { CalendarEvent, ReminderOffset } from './types'

export default function App() {
  const { isConfigured, accounts, linking, error: linkError, linkAccount, unlinkAccount } = useGoogleAccounts()
  const { events, loading, error, refresh } = useCalendarEvents(accounts)
  const [offsetMinutes, setOffsetMinutes] = useLocalStorage<ReminderOffset>('reminder-offset', 15)
  const [overrides, setOverrides] = useLocalStorage<Record<string, boolean>>('reminder-overrides', {})
  const { reminders, firedAlarms, dismissAlarm } = useReminders(events, offsetMinutes, overrides)
  const schedule = useClassSchedule(accounts)
  const agent = useAgentChat({ accounts, events, schedule, refreshEvents: refresh })

  const isLinked = accounts.length > 0

  useEffect(() => {
    if (isLinked) requestNotificationPermission()
  }, [isLinked])

  const addGoalEverywhere = async ({ text, date, time }: { text: string; date: string; time?: string }) => {
    const [y, m, d] = date.split('-').map(Number)
    await Promise.all(accounts.map((account) => createEvent(account.accessToken, { summary: text, date: new Date(y, m - 1, d), time })))
    await refresh()
  }

  const deleteEvent = async (event: CalendarEvent) => {
    const account = accounts.find((a) => a.email === event.accountEmail)
    if (!account) return
    await deleteCalendarEvent(account.accessToken, event.id)
    await refresh()
  }

  return (
    <div className="app">
      <AlarmBanner alarms={firedAlarms} onDismiss={dismissAlarm} />

      <header className="app-header">
        <h1>📚 Study Buddy</h1>
        <p className="muted">Tu calendario, tus recordatorios de estudio y tu cronómetro, todo en un lugar.</p>
      </header>

      <LoginButton
        isConfigured={isConfigured}
        accounts={accounts}
        linking={linking}
        error={linkError}
        onLink={linkAccount}
        onUnlink={unlinkAccount}
      />

      <main className="layout">
        <div className="column">
          {isLinked ? (
            <EventsList
              reminders={reminders}
              loading={loading}
              error={error}
              offsetMinutes={offsetMinutes}
              onOffsetChange={setOffsetMinutes}
              onToggleReminder={(key, enabled) => setOverrides((prev) => ({ ...prev, [key]: enabled }))}
              onToggleSeries={(summary, enabled) =>
                setOverrides((prev) => {
                  const next = { ...prev }
                  events.filter((e) => e.summary === summary).forEach((e) => {
                    next[eventKey(e)] = enabled
                  })
                  return next
                })
              }
              onRefresh={refresh}
              onAddGoal={addGoalEverywhere}
              onDeleteEvent={deleteEvent}
              showAccountLabel={accounts.length > 1}
            />
          ) : (
            isConfigured && (
              <div className="card">
                <p className="muted">Vinculá tu cuenta de Google para ver tus eventos, agregar objetivos y activar los recordatorios.</p>
              </div>
            )
          )}
          <ClassSchedule accounts={accounts} schedule={schedule} />
        </div>

        <div className="column">
          <StudyTimer />
        </div>
      </main>

      <footer className="app-footer">
        <p className="muted">
          Los recordatorios suenan mientras esta pestaña esté abierta en tu navegador. Los objetivos y el horario se guardan
          como eventos reales en tu Google Calendar (en todas tus cuentas vinculadas); el cronómetro se guarda solo en este
          dispositivo.
        </p>
      </footer>

      <AgentChat
        chatLog={agent.chatLog}
        sendMessage={agent.sendMessage}
        sending={agent.sending}
        error={agent.error}
        isConfigured={agent.isConfigured}
      />
    </div>
  )
}
