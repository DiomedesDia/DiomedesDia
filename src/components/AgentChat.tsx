import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../hooks/useAgentChat'

interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionResultLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

interface Props {
  chatLog: ChatMessage[]
  sendMessage: (text: string) => Promise<void>
  sending: boolean
  error: string | null
  isConfigured: boolean
  voiceEnabled: boolean
  onToggleVoice: () => void
}

const SUGGESTIONS = [
  'Agregame un parcial de Cálculo el viernes a las 10am',
  '¿Qué tengo esta semana?',
  'Posponé mi clase del lunes para el miércoles a las 3pm',
]

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function AgentChat({ chatLog, sendMessage, sending, error, isConfigured, voiceEnabled, onToggleVoice }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [listening, setListening] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const prevLogLength = useRef(0)
  const speechSupported = getSpeechRecognitionCtor() !== null

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatLog, sending])

  useEffect(() => {
    if (chatLog.length > prevLogLength.current && !open) {
      setHasUnread(true)
    }
    prevLogLength.current = chatLog.length
  }, [chatLog, open])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    sendMessage(text)
  }

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.lang = 'es-ES'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) sendMessage(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const openPanel = () => {
    setOpen(true)
    setHasUnread(false)
  }

  if (!open) {
    return (
      <button className="agent-fab" onClick={openPanel} aria-label="Abrir asistente de calendario">
        🤖
        {hasUnread && <span className="agent-fab-badge" />}
      </button>
    )
  }

  return (
    <div className="agent-panel">
      <div className="agent-panel-header">
        <span>🤖 Asistente de calendario</span>
        <div className="agent-panel-actions">
          <button
            className="icon-btn"
            onClick={onToggleVoice}
            aria-label={voiceEnabled ? 'Silenciar respuestas por voz' : 'Activar respuestas por voz'}
            title={voiceEnabled ? 'Respuestas por voz activadas' : 'Respuestas por voz silenciadas'}
          >
            {voiceEnabled ? '🔊' : '🔇'}
          </button>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar asistente">
            ✕
          </button>
        </div>
      </div>

      {!isConfigured && (
        <p className="muted small-note agent-warning">
          Falta configurar el servidor del agente (variable <code>GEMINI_API_KEY</code>). Mirá el README para activarlo.
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
        {speechSupported && (
          <button
            type="button"
            className={listening ? 'mic-btn listening' : 'mic-btn'}
            onClick={toggleListening}
            disabled={!isConfigured}
            aria-label={listening ? 'Detener grabación' : 'Hablarle al asistente'}
            title={listening ? 'Escuchando…' : 'Hablarle al asistente'}
          >
            🎤
          </button>
        )}
        <input
          className="text-input"
          type="text"
          placeholder={listening ? 'Escuchando…' : 'Escribile al asistente…'}
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
