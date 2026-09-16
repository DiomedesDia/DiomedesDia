interface Props {
  isConfigured: boolean
  isSignedIn: boolean
  error: string | null
  onSignIn: () => void
  onSignOut: () => void
}

export function LoginButton({ isConfigured, isSignedIn, error, onSignIn, onSignOut }: Props) {
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
      {isSignedIn ? (
        <button className="btn secondary" onClick={onSignOut}>
          Cerrar sesión de Google
        </button>
      ) : (
        <button className="btn primary" onClick={onSignIn}>
          Conectar con Google Calendar
        </button>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
