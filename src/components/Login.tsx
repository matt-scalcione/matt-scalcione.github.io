import { FormEvent, useState } from 'react'
import { PASSWORD_HASH, SESSION_KEY } from '../utils/constants'
import { hashText } from '../utils/security'

interface LoginProps {
  onAuthenticated: () => void
}

export const Login = ({ onAuthenticated }: LoginProps) => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const hash = await hashText(password)
      if (hash === PASSWORD_HASH) {
        sessionStorage.setItem(SESSION_KEY, 'true')
        onAuthenticated()
      } else {
        setError('Incorrect password. Access is restricted to the estate administrator.')
      }
    } finally {
      setLoading(false)
      setPassword('')
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Estate Executor Dashboard</h1>
        <p className="login-copy">Enter the private passphrase to access the administration workspace.</p>
        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Verifying…' : 'Unlock dashboard'}
        </button>
      </form>
    </div>
  )
}
