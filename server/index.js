import express from 'express'
import dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'

dotenv.config()

const app = express()
app.use(express.json({ limit: '2mb' }))

const client = new Anthropic() // lee ANTHROPIC_API_KEY del entorno; nunca llega al navegador

const MODEL = 'claude-opus-5'

const CALENDAR_TOOLS = [
  {
    name: 'create_event',
    description:
      'Crea un evento puntual (objetivo de estudio, parcial, entrega de proyecto) en el calendario de todas las cuentas de Google vinculadas.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Título del evento, breve y claro' },
        date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        time: {
          type: 'string',
          description: 'Hora en formato HH:MM de 24 horas. Si se omite, el evento queda como "todo el día".',
        },
      },
      required: ['summary', 'date'],
    },
  },
  {
    name: 'delete_event',
    description:
      'Borra un evento puntual que ya existe (creado antes por la app). Necesita el eventId y accountEmail exactos de la lista de "próximos eventos" del contexto.',
    input_schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string' },
        accountEmail: { type: 'string' },
      },
      required: ['eventId', 'accountEmail'],
    },
  },
  {
    name: 'add_class',
    description: 'Agrega una clase nueva al horario semanal recurrente y la sincroniza con todas las cuentas vinculadas.',
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Nombre de la materia' },
        day: { type: 'string', enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'], description: 'Día de la semana' },
        startTime: { type: 'string', description: 'Hora de inicio HH:MM (24h)' },
        endTime: { type: 'string', description: 'Hora de fin HH:MM (24h)' },
        location: { type: 'string', description: 'Lugar y/o profesor, opcional' },
      },
      required: ['subject', 'day', 'startTime', 'endTime'],
    },
  },
  {
    name: 'edit_class',
    description:
      'Edita una clase existente del horario semanal (por ejemplo, para posponerla a otro día u horario, o corregir un dato). Solo hace falta mandar los campos que cambian. Necesita el classId exacto de la lista de "horario semanal" del contexto.',
    input_schema: {
      type: 'object',
      properties: {
        classId: { type: 'string' },
        subject: { type: 'string' },
        day: { type: 'string', enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] },
        startTime: { type: 'string' },
        endTime: { type: 'string' },
        location: { type: 'string' },
      },
      required: ['classId'],
    },
  },
  {
    name: 'delete_class',
    description: 'Elimina una clase del horario semanal, incluyendo sus eventos recurrentes en Google Calendar.',
    input_schema: {
      type: 'object',
      properties: { classId: { type: 'string' } },
      required: ['classId'],
    },
  },
]

function formatEventLine(event) {
  return `- [id=${event.id} cuenta=${event.accountEmail}] "${event.summary}" — ${event.start}${event.isAllDay ? ' (todo el día)' : ''}`
}

function formatClassLine(classEntry) {
  const parts = [classEntry.subject, classEntry.day, `${classEntry.startTime}-${classEntry.endTime}`]
  if (classEntry.location) parts.push(classEntry.location)
  return `- [id=${classEntry.id}] ${parts.join(' · ')}`
}

function buildSystemPrompt(context) {
  const accounts = context.accounts?.length ? context.accounts.join(', ') : '(ninguna vinculada todavía)'
  const events = context.events?.length ? context.events.map(formatEventLine).join('\n') : '(sin eventos próximos)'
  const classes = context.classes?.length ? context.classes.map(formatClassLine).join('\n') : '(horario vacío)'

  return `Sos el asistente de calendario de Study Buddy, una app de organización de estudio para un estudiante universitario.
Hoy es ${context.today} (${context.timeZone ?? 'zona horaria local del usuario'}).
Cuentas de Google vinculadas: ${accounts}

Próximos eventos:
${events}

Horario semanal:
${classes}

Usá las herramientas disponibles para crear, editar o borrar eventos puntuales (objetivos, parciales, entregas) y clases del
horario semanal cuando el usuario lo pida. Para editar o borrar algo, primero identificá el id correcto en el contexto de
arriba; si no encontrás una coincidencia clara, preguntale al usuario en vez de adivinar. Si el usuario da una fecha
relativa ("mañana", "el jueves que viene"), calculala vos mismo a partir de la fecha de hoy. Respondé siempre en español,
de forma breve y conversacional — no repitas toda la información del contexto, solo confirmá lo que hiciste o preguntá lo
que falte.`
}

app.get('/api/health', (_req, res) => {
  res.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) })
})

app.post('/api/agent', async (req, res) => {
  try {
    const { messages, context } = req.body
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: 'Falta el array de mensajes.' })
      return
    }
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: 'low' },
      system: buildSystemPrompt(context ?? {}),
      tools: CALENDAR_TOOLS,
      messages,
    })
    res.json(response)
  } catch (err) {
    console.error('Error del agente:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error del agente.' })
  }
})

const PORT = process.env.AGENT_PORT || 3001
app.listen(PORT, () => {
  console.log(`Servidor del agente escuchando en http://localhost:${PORT}`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  Falta ANTHROPIC_API_KEY en tu .env — el agente no va a poder responder.')
  }
})
