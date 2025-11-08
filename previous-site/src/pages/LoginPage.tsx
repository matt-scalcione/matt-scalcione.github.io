import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, rememberDevice } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(rememberDevice)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const success = await login(username.trim(), password, remember)
      if (!success) {
        setError('Invalid username or password. Please try again.')
        return
      }
      const redirect = (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname ?? '/'
      navigate(redirect, { replace: true })
    } catch (caughtError) {
      console.error('Failed to log in', caughtError)
      setError('Unexpected error while signing in. Please try again.')
    } finally {
      setSubmitting(false)
      setPassword('')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white/10 p-8 text-slate-100 shadow-xl backdrop-blur">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Estate Executor Dashboard</h1>
          <p className="text-sm text-slate-300">Sign in to manage the Pennsylvania estate workspace.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="input bg-white/90 text-slate-900"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-200" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input bg-white/90 text-slate-900"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-400 text-brand-500 focus:ring-brand-500"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember this device for faster access
          </label>
          {error && <p className="rounded-lg bg-rose-500/20 px-3 py-2 text-sm text-rose-100">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Verifying…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-xs text-slate-400">
          Access is restricted to the estate executor. Sessions time out after 30 minutes of inactivity.
        </p>
      </div>
    </div>
  )
}
