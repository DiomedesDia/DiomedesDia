import { useCallback, useEffect, useRef, useState } from 'react'

// calendar.events cubre lectura y escritura de eventos (crear/editar/borrar), sin dar acceso
// a la configuración de los calendarios en sí. Necesario para poder sincronizar los objetivos
// diarios como eventos.
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
// v2 porque el scope cambió (antes era solo lectura): un token viejo guardado no alcanza y
// hay que forzar un nuevo inicio de sesión que pida el permiso de escritura.
const TOKEN_STORAGE_KEY = 'gcal-access-token-v2'

interface StoredToken {
  accessToken: string
  expiresAt: number
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
          revoke: (token: string, done: () => void) => void
        }
      }
    }
  }
}

function loadStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredToken
    if (parsed.expiresAt <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

export function useGoogleAuth() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  const [accessToken, setAccessToken] = useState<string | null>(() => loadStoredToken()?.accessToken ?? null)
  const [gsiReady, setGsiReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenClientRef = useRef<ReturnType<NonNullable<Window['google']>['accounts']['oauth2']['initTokenClient']> | null>(null)

  useEffect(() => {
    if (!clientId) return

    let cancelled = false
    const initialize = () => {
      if (cancelled || !window.google) return
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (response) => {
          if (response.error || !response.access_token) {
            setError(response.error ?? 'No se pudo obtener acceso a Google Calendar.')
            return
          }
          const expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000
          localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ accessToken: response.access_token, expiresAt }))
          setError(null)
          setAccessToken(response.access_token)
        },
      })
      setGsiReady(true)
    }

    if (window.google) {
      initialize()
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval)
          initialize()
        }
      }, 100)
      return () => {
        cancelled = true
        clearInterval(interval)
      }
    }
  }, [clientId])

  const signIn = useCallback((interactive = true) => {
    if (!tokenClientRef.current) {
      setError('Google todavía no está listo, intenta de nuevo en un segundo.')
      return
    }
    tokenClientRef.current.requestAccessToken({ prompt: interactive ? 'consent' : '' })
  }, [])

  const signOut = useCallback(() => {
    if (accessToken && window.google) {
      window.google.accounts.oauth2.revoke(accessToken, () => {})
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setAccessToken(null)
  }, [accessToken])

  return {
    isConfigured: Boolean(clientId),
    gsiReady,
    accessToken,
    isSignedIn: Boolean(accessToken),
    error,
    signIn,
    signOut,
  }
}
