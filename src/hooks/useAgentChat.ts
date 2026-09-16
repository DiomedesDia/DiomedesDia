import { useCallback, useEffect, useState } from 'react'
import type { CalendarEvent, LinkedAccount, Weekday } from '../types'
import type { ClassScheduleApi } from './useClassSchedule'
import { createEvent, deleteCalendarEvent } from '../utils/googleCalendarApi'

interface AgentTextBlock {
  type: 'text'
  text: string
}
interface AgentToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}
interface AgentToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
}
type AgentContentBlock = AgentTextBlock | AgentToolUseBlock | AgentToolResultBlock

interface AgentRequestMessage {
  role: 'user' | 'assistant'
  content: string | AgentContentBlock[]
}

interface AgentApiResponse {
  content: AgentContentBlock[]
  stop_reason: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

interface Deps {
  accounts: LinkedAccount[]
  events: CalendarEvent[]
  schedule: ClassScheduleApi
  refreshEvents: () => Promise<void>
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

const MAX_TOOL_ROUNDS = 6

export function useAgentChat({ accounts, events, schedule, refreshEvents }: Deps) {
  const [chatLog, setChatLog] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<AgentRequestMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(true)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setIsConfigured(Boolean(data.configured)))
      .catch(() => setIsConfigured(false))
  }, [])

  const buildContext = useCallback(
    () => ({
      today: new Date().toISOString().slice(0, 10),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      accounts: accounts.map((a) => a.email),
      events: events.slice(0, 30).map((e) => ({
        id: e.id,
        accountEmail: e.accountEmail,
        summary: e.summary,
        start: e.start.toISOString(),
        isAllDay: e.isAllDay,
      })),
      classes: schedule.classes,
    }),
    [accounts, events, schedule.classes],
  )

  const executeTool = useCallback(
    async (name: string, input: Record<string, unknown>): Promise<string> => {
      switch (name) {
        case 'create_event': {
          const summary = str(input.summary)
          const date = str(input.date)
          if (!summary || !date) return 'Faltan datos para crear el evento (título o fecha).'
          if (accounts.length === 0) return 'No hay ninguna cuenta de Google vinculada.'
          const [y, m, d] = date.split('-').map(Number)
          await Promise.all(
            accounts.map((a) => createEvent(a.accessToken, { summary, date: new Date(y, m - 1, d), time: str(input.time) })),
          )
          await refreshEvents()
          return `Listo, creé "${summary}" el ${date}${input.time ? ` a las ${str(input.time)}` : ''} en ${accounts.length} cuenta(s).`
        }
        case 'delete_event': {
          const eventId = str(input.eventId)
          const accountEmail = str(input.accountEmail)
          const account = accounts.find((a) => a.email === accountEmail)
          if (!eventId || !account) return 'No encontré ese evento o esa cuenta.'
          await deleteCalendarEvent(account.accessToken, eventId)
          await refreshEvents()
          return 'Evento borrado.'
        }
        case 'add_class': {
          const subject = str(input.subject)
          const day = str(input.day) as Weekday | undefined
          const startTime = str(input.startTime)
          const endTime = str(input.endTime)
          if (!subject || !day || !startTime || !endTime) return 'Faltan datos para agregar la clase.'
          schedule.addClass({ subject, day, startTime, endTime, location: str(input.location) })
          return `Agregué "${subject}" al horario.`
        }
        case 'edit_class': {
          const classId = str(input.classId)
          if (!classId) return 'Falta el id de la clase a editar.'
          const ok = await schedule.editClass(classId, {
            subject: str(input.subject),
            day: str(input.day) as Weekday | undefined,
            startTime: str(input.startTime),
            endTime: str(input.endTime),
            location: str(input.location),
          })
          return ok ? 'Clase actualizada.' : 'No encontré esa clase en el horario.'
        }
        case 'delete_class': {
          const classId = str(input.classId)
          if (!classId) return 'Falta el id de la clase a borrar.'
          const ok = schedule.removeClass(classId)
          return ok ? 'Clase eliminada del horario.' : 'No encontré esa clase en el horario.'
        }
        default:
          return `Herramienta desconocida: ${name}`
      }
    },
    [accounts, refreshEvents, schedule],
  )

  const callAgent = useCallback(
    async (messages: AgentRequestMessage[]): Promise<AgentApiResponse> => {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context: buildContext() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error del agente.')
      return data as AgentApiResponse
    },
    [buildContext],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return
      setSending(true)
      setError(null)
      setChatLog((prev) => [...prev, { role: 'user', text: trimmed }])

      let currentMessages: AgentRequestMessage[] = [...history, { role: 'user', content: trimmed }]
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await callAgent(currentMessages)
          currentMessages = [...currentMessages, { role: 'assistant', content: response.content }]

          if (response.stop_reason !== 'tool_use') {
            const textBlock = response.content.find((b): b is AgentTextBlock => b.type === 'text')
            setChatLog((prev) => [...prev, { role: 'assistant', text: textBlock?.text ?? '(sin respuesta)' }])
            setHistory(currentMessages)
            return
          }

          const toolUses = response.content.filter((b): b is AgentToolUseBlock => b.type === 'tool_use')
          const toolResults: AgentToolResultBlock[] = await Promise.all(
            toolUses.map(async (block) => ({
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: await executeTool(block.name, block.input),
            })),
          )
          currentMessages = [...currentMessages, { role: 'user', content: toolResults }]
        }
        setError('El agente encadenó demasiadas acciones seguidas — probá de nuevo con un pedido más simple.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo conectar con el agente.')
      } finally {
        setSending(false)
      }
    },
    [callAgent, executeTool, history, sending],
  )

  return { chatLog, sendMessage, sending, error, isConfigured }
}
