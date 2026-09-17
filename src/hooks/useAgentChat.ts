import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalendarEvent, LinkedAccount, Weekday } from '../types'
import type { ClassScheduleApi } from './useClassSchedule'
import { createEvent, deleteCalendarEvent } from '../utils/googleCalendarApi'
import { mergeEventsAcrossAccounts } from '../utils/mergeEvents'
import { formatTimeOnly } from '../utils/formatDate'

interface FunctionCallPart {
  functionCall: { id?: string; name: string; args: Record<string, unknown> }
}
interface FunctionResponsePart {
  functionResponse: { id?: string; name: string; response: Record<string, unknown> }
}
interface TextPart {
  text: string
}
type AgentPart = TextPart | FunctionCallPart | FunctionResponsePart

interface AgentContent {
  role: 'user' | 'model'
  parts: AgentPart[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

interface Deps {
  accounts: LinkedAccount[]
  events: CalendarEvent[]
  loading: boolean
  schedule: ClassScheduleApi
  refreshEvents: () => Promise<void>
}

function isFunctionCallPart(part: AgentPart): part is FunctionCallPart {
  return 'functionCall' in part
}
function isTextPart(part: AgentPart): part is TextPart {
  return 'text' in part && typeof part.text === 'string'
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function loadVoicePreference(): boolean {
  try {
    return localStorage.getItem('agent-voice-enabled') !== 'false'
  } catch {
    return true
  }
}

/** Arma un saludo con un resumen del día, sin llamar a la API (gratis e instantáneo). */
function buildGreeting(accounts: LinkedAccount[], events: CalendarEvent[], pendingClasses: number): string {
  const hour = new Date().getHours()
  const salutation = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  if (accounts.length === 0) {
    return `${salutation}, soy tu asistente de calendario. Vinculá una cuenta de Google arriba para que pueda ayudarte con tus eventos y tu horario.`
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

  const todaysEvents = mergeEventsAcrossAccounts(events.filter((e) => e.start >= startOfToday && e.start < startOfTomorrow))

  let message = `${salutation}! `
  if (todaysEvents.length === 0) {
    message += 'No tenés eventos para hoy. '
  } else if (todaysEvents.length === 1) {
    const e = todaysEvents[0].event
    message += `Hoy tenés "${e.summary}" ${formatTimeOnly(e.start, e.isAllDay).toLowerCase()}. `
  } else {
    const next = todaysEvents[0].event
    message += `Hoy tenés ${todaysEvents.length} eventos, el próximo es "${next.summary}" a las ${formatTimeOnly(next.start, next.isAllDay)}. `
  }

  if (pendingClasses > 0) {
    message += `Che, te faltan ${pendingClasses} clase${pendingClasses === 1 ? '' : 's'} del horario por sincronizar.`
  } else {
    message += '¿En qué te ayudo?'
  }

  return message.trim()
}

const MAX_TOOL_ROUNDS = 6

export function useAgentChat({ accounts, events, loading, schedule, refreshEvents }: Deps) {
  const [chatLog, setChatLog] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<AgentContent[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(loadVoicePreference)
  const hasGreetedRef = useRef(false)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setIsConfigured(Boolean(data.configured)))
      .catch(() => setIsConfigured(false))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('agent-voice-enabled', String(voiceEnabled))
    } catch {
      // localStorage no disponible; se ignora
    }
  }, [voiceEnabled])

  // Saluda una sola vez, apenas terminan de cargar los eventos (sin gastar cuota de la API).
  useEffect(() => {
    if (hasGreetedRef.current || loading || accounts.length === 0) return
    hasGreetedRef.current = true
    const greeting = buildGreeting(accounts, events, schedule.pendingCount)
    setChatLog((prev) => (prev.length === 0 ? [{ role: 'assistant', text: greeting }] : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, accounts.length])

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled) return
      if (typeof window === 'undefined' || !window.speechSynthesis) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'es-ES'
      window.speechSynthesis.speak(utterance)
    },
    [voiceEnabled],
  )

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
    async (contents: AgentContent[]): Promise<AgentContent> => {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, context: buildContext() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error del agente.')
      return data as AgentContent
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

      let currentContents: AgentContent[] = [...history, { role: 'user', parts: [{ text: trimmed }] }]
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const modelTurn = await callAgent(currentContents)
          currentContents = [...currentContents, modelTurn]

          const functionCalls = modelTurn.parts.filter(isFunctionCallPart)
          if (functionCalls.length === 0) {
            const textPart = modelTurn.parts.find(isTextPart)
            const replyText = textPart?.text ?? '(sin respuesta)'
            setChatLog((prev) => [...prev, { role: 'assistant', text: replyText }])
            setHistory(currentContents)
            speak(replyText)
            return
          }

          const responseParts: FunctionResponsePart[] = await Promise.all(
            functionCalls.map(async ({ functionCall }) => ({
              functionResponse: {
                id: functionCall.id,
                name: functionCall.name,
                response: { result: await executeTool(functionCall.name, functionCall.args ?? {}) },
              },
            })),
          )
          currentContents = [...currentContents, { role: 'user', parts: responseParts }]
        }
        setError('El agente encadenó demasiadas acciones seguidas — probá de nuevo con un pedido más simple.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo conectar con el agente.')
      } finally {
        setSending(false)
      }
    },
    [callAgent, executeTool, history, sending, speak],
  )

  return { chatLog, sendMessage, sending, error, isConfigured, voiceEnabled, setVoiceEnabled }
}
