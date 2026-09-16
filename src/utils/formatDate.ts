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

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}
