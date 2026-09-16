import { useCallback, useEffect, useRef, useState } from 'react'
import type { LinkedAccount } from '../types'

// calendar.events cubre lectura y escritura de eventos (crear/editar/borrar), sin dar acceso
// a la configuración de los calendarios en sí. userinfo.email es para saber QUÉ cuenta se acaba
// de vincular (y no pisar otra que ya estaba vinculada).
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email'
const STORAGE_KEY = 'gcal-linked-accounts-v1'

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

function loadStoredAccounts(): LinkedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LinkedAccount[]
    const now = Date.now()
    return parsed.filter((a) => a.expiresAt > now)
  } catch {
    return []
  }
}

function saveStoredAccounts(accounts: LinkedAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
  } catch {
    // localStorage lleno o no disponible; se ignora
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

/** Maneja varias cuentas de Google vinculadas a la vez (no solo una activa). */
export function useGoogleAccounts() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  const [accounts, setAccounts] = useState<LinkedAccount[]>(() => loadStoredAccounts())
  const [gsiReady, setGsiReady] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenClientRef = useRef<ReturnType<NonNullable<Window['google']>['accounts']['oauth2']['initTokenClient']> | null>(null)

  useEffect(() => {
    saveStoredAccounts(accounts)
  }, [accounts])

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
            setLinking(false)
            setError(response.error ?? 'No se pudo obtener acceso a Google Calendar.')
            return
          }
          const token = response.access_token
          const expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000
          fetchAccountEmail(token).then((email) => {
            setLinking(false)
            if (!email) {
              setError('No se pudo identificar la cuenta de Google conectada.')
              return
            }
            setError(null)
            setAccounts((prev) => {
              const withoutThisEmail = prev.filter((a) => a.email !== email)
              return [...withoutThisEmail, { email, accessToken: token, expiresAt }]
            })
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

  const linkAccount = useCallback(() => {
    if (!tokenClientRef.current) {
      setError('Google todavía no está listo, intenta de nuevo en un segundo.')
      return
    }
    setLinking(true)
    // select_account fuerza que Google siempre muestre el selector de cuenta, así se puede
    // elegir con cuál cuenta vincularse (para agregar otra, no repetir la misma).
    tokenClientRef.current.requestAccessToken({ prompt: 'select_account consent' })
  }, [])

  const unlinkAccount = useCallback((email: string) => {
    setAccounts((prev) => {
      const account = prev.find((a) => a.email === email)
      if (account && window.google) {
        window.google.accounts.oauth2.revoke(account.accessToken, () => {})
      }
      return prev.filter((a) => a.email !== email)
    })
  }, [])

  return {
    isConfigured: Boolean(clientId),
    gsiReady,
    accounts,
    linking,
    error,
    linkAccount,
    unlinkAccount,
  }
}
