const EVENTS_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function goalSummary(text: string, done: boolean): string {
  return `${done ? '✅' : '🎯'} ${text}`
}

/** Crea un evento de día completo para un objetivo diario. Devuelve el id del evento o null si falló. */
export async function createGoalEvent(accessToken: string, text: string, date: Date): Promise<string | null> {
  try {
    const day = dateOnly(date)
    const res = await fetch(EVENTS_BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: goalSummary(text, false),
        start: { date: day },
        end: { date: day },
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: string }
    return data.id ?? null
  } catch {
    return null
  }
}

export async function updateGoalEvent(accessToken: string, eventId: string, text: string, done: boolean): Promise<void> {
  try {
    await fetch(`${EVENTS_BASE}/${eventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: goalSummary(text, done) }),
    })
  } catch {
    // si falla, el objetivo sigue funcionando localmente; se sincroniza en el próximo cambio
  }
}

export async function deleteGoalEvent(accessToken: string, eventId: string): Promise<void> {
  try {
    await fetch(`${EVENTS_BASE}/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    // se ignora: si el evento ya no existe o falla la red, no hay nada más que hacer
  }
}
