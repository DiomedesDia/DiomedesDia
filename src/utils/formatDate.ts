export function formatEventTime(date: Date, isAllDay: boolean): string {
  if (isAllDay) {
    return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
  }
  return date.toLocaleString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Solo la hora (o "Todo el día"), para usar debajo de un encabezado de día que ya muestra la fecha. */
export function formatTimeOnly(date: Date, isAllDay: boolean): string {
  if (isAllDay) return 'Todo el día'
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

/** "Hoy" / "Mañana" / "Miércoles 17 de septiembre", para agrupar una lista de eventos por día. */
export function formatDayHeader(date: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  const label = date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** yyyy-mm-dd en hora LOCAL (toISOString() usa UTC y corre el día cerca de medianoche). */
export function todayKey(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}
