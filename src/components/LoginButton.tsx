import type { LinkedAccount } from '../types'

interface Props {
  isConfigured: boolean
  accounts: LinkedAccount[]
  linking: boolean
  error: string | null
  onLink: () => void
  onUnlink: (email: string) => void
}

export function LoginButton({ isConfigured, accounts, linking, error, onLink, onUnlink }: Props) {
  if (!isConfigured) {
    return (
      <div className="card warning">
        <p>
          Falta configurar <code>VITE_GOOGLE_CLIENT_ID</code> en tu archivo <code>.env</code>. Revisa el{' '}
          <strong>README.md</strong> para crear las credenciales OAuth en Google Cloud Console.
        </p>
      </div>
    )
  }

  return (
    <div className="login-bar">
      {accounts.length > 0 && (
        <ul className="account-list">
          {accounts.map((account) => (
            <li key={account.email}>
              <span>{account.email}</span>
              <button className="icon-btn" onClick={() => onUnlink(account.email)} aria-label={`Desvincular ${account.email}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn primary" onClick={onLink} disabled={linking}>
        {linking ? 'Conectando…' : accounts.length > 0 ? 'Vincular otra cuenta' : 'Conectar con Google Calendar'}
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
