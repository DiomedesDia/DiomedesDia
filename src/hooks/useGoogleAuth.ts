import { useCallback, useEffect, useRef, useState } from 'react'

// calendar.events cubre lectura y escritura de eventos (crear/editar/borrar), sin dar acceso
// a la configuración de los calendarios en sí. userinfo.email es para saber QUÉ cuenta está
// conectada (para poder separar el horario de cada una).
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email'
// v3 porque el scope cambió (se agregó email): un token viejo guardado no alcanza y hay que
// forzar un nuevo inicio de sesión que pida el permiso nuevo.
const TOKEN_STORAGE_KEY = 'gcal-access-token-v3'

interface StoredToken {
  accessToken: string
  expiresAt: number
  email: string | null
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

async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { email?: string }
    return data.email ?? null
  } catch {
    return null
  }
}

export function useGoogleAuth() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  const initialStored = loadStoredToken()
  const [accessToken, setAccessToken] = useState<string | null>(initialStored?.accessToken ?? null)
  const [accountEmail, setAccountEmail] = useState<string | null>(initialStored?.email ?? null)
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
          const token = response.access_token
          const expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000
          setError(null)
          setAccessToken(token)
          fetchAccountEmail(token).then((email) => {
            localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ accessToken: token, expiresAt, email }))
            setAccountEmail(email)
          })
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
    // select_account fuerza que Google siempre muestre el selector de cuenta, así se puede
    // elegir explícitamente con cuál cuenta conectarse (no solo reusar la última activa).
    tokenClientRef.current.requestAccessToken({ prompt: interactive ? 'select_account consent' : '' })
  }, [])

  const signOut = useCallback(() => {
    if (accessToken && window.google) {
      window.google.accounts.oauth2.revoke(accessToken, () => {})
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setAccessToken(null)
    setAccountEmail(null)
  }, [accessToken])

  return {
    isConfigured: Boolean(clientId),
    gsiReady,
    accessToken,
    accountEmail,
    isSignedIn: Boolean(accessToken),
    error,
    signIn,
    signOut,
  }
}
