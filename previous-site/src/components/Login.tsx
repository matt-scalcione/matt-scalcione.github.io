import { FormEvent, useState } from 'react'
import { SESSION_STORAGE_KEY } from '../utils/constants'
import { buildApiUrl, fetchWithRetry } from '../utils/api'

interface LoginSuccess {
  token: string
  userId: string
  username: string
}

interface LoginProps {
  onAuthenticated: (session: LoginSuccess) => void
}

type LoginResponse = {
  token: string
  user: {
    id: string
    username: string
  }
}

export const Login = ({ onAuthenticated }: LoginProps) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const credentials = {
        username: username.trim(),
        password
      }
      const response = await fetchWithRetry(buildApiUrl('/api/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      })

      if (response.status === 401) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? 'Invalid username or password. Access is restricted to authorized administrators.')
        return
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? 'Unable to sign in. Please try again.')
        return
      }

      const payload = (await response.json()) as LoginResponse
      const session: LoginSuccess = {
        token: payload.token,
        userId: payload.user.id,
        username: payload.user.username
      }
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
      onAuthenticated(session)
    } catch (caughtError) {
      console.error('Failed to submit login request', caughtError)
      setError('Unable to reach the authentication service. Please check your connection and try again.')
    } finally {
      setLoading(false)
      setPassword('')
    }
  }

  return (
    <div className="login-screen">
      <form
        className="login-card"
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
      >
        <h1>Estate Executor Dashboard</h1>
        <p className="login-copy">Sign in with your estate administrator credentials to access the workspace.</p>
        <label>
          <span>Username</span>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Verifying…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
