import type { FiredAlarm } from '../hooks/useReminders'

interface Props {
  alarms: FiredAlarm[]
  onDismiss: (key: string) => void
}

export function AlarmBanner({ alarms, onDismiss }: Props) {
  if (alarms.length === 0) return null

  return (
    <div className="alarm-overlay">
      {alarms.map((alarm) => (
        <div key={alarm.key} className="alarm-card">
          <p className="alarm-icon">⏰</p>
          <h3>¡Hora de estudiar!</h3>
          <p>{alarm.summary}</p>
          <button className="btn primary" onClick={() => onDismiss(alarm.key)}>
            Entendido
          </button>
        </div>
      ))}
    </div>
  )
}
