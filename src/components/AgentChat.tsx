import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../hooks/useAgentChat'

interface Props {
  chatLog: ChatMessage[]
  sendMessage: (text: string) => Promise<void>
  sending: boolean
  error: string | null
  isConfigured: boolean
}

const SUGGESTIONS = [
  'Agregame un parcial de Cálculo el viernes a las 10am',
  '¿Qué tengo esta semana?',
  'Posponé mi clase del lunes para el miércoles a las 3pm',
]

export function AgentChat({ chatLog, sendMessage, sending, error, isConfigured }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatLog, sending])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    sendMessage(text)
  }

  if (!open) {
    return (
      <button className="agent-fab" onClick={() => setOpen(true)} aria-label="Abrir asistente de calendario">
        🤖
      </button>
    )
  }

  return (
    <div className="agent-panel">
      <div className="agent-panel-header">
        <span>🤖 Asistente de calendario</span>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar asistente">
          ✕
        </button>
      </div>

      {!isConfigured && (
        <p className="muted small-note agent-warning">
          Falta configurar el servidor del agente (variable <code>ANTHROPIC_API_KEY</code>). Mirá el README para activarlo.
        </p>
      )}

      <div className="agent-log" ref={logRef}>
        {chatLog.length === 0 && (
          <div className="agent-empty">
            <p className="muted">Pedime cosas como:</p>
            <ul className="agent-suggestions">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" className="link-btn" onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {chatLog.map((m, i) => (
          <div key={i} className={`agent-bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {sending && <div className="agent-bubble assistant agent-typing">Pensando…</div>}
      </div>

      {error && <p className="error-text agent-error">{error}</p>}

      <form className="agent-input-row" onSubmit={submit}>
        <input
          className="text-input"
          type="text"
          placeholder="Escribile al asistente…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending || !isConfigured}
        />
        <button className="btn primary" type="submit" disabled={sending || !isConfigured}>
          Enviar
        </button>
      </form>
    </div>
  )
}
