import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Login = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isReady, login, logout, mode, userEmail } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    if (!isReady) {
      return
    }

    if (mode === 'demo' && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, isReady, mode, navigate])

  useEffect(() => {
    setError(null)
    setIdentifier('')
    setPassword('')
  }, [mode])

  if (!isReady) {
    return (
      <section className="mx-auto max-w-xl space-y-6 rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-primary-600">Checking your session…</p>
      </section>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(identifier, password)
      navigate('/dashboard', { replace: true })
    } catch (loginError) {
      console.error(loginError)
      const message = loginError instanceof Error && loginError.message
        ? loginError.message
        : 'Unable to sign in. Please try again.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    setError(null)
    setIsSigningOut(true)

    try {
      await logout()
    } catch (signOutError) {
      console.error(signOutError)
      setError('Unable to sign out. Try again in a moment.')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6 rounded-2xl bg-white p-8 shadow-sm">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-slate-900">Sign in</h1>
        <p className="text-sm text-slate-500">
          {mode === 'supabase'
            ? 'Connect with your Supabase credentials to sync data across devices.'
            : 'Access your estate planning tools and stay on top of upcoming tasks.'}
        </p>
      </div>
      {mode === 'supabase' && isAuthenticated ? (
        <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-800">
          <p className="font-semibold">Signed in as {userEmail ?? 'unknown user'}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="rounded-full bg-primary-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-500"
            >
              Go to dashboard
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="rounded-full border border-primary-300 px-4 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      ) : null}
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <div className="space-y-1 text-left">
          <label className="block text-sm font-medium text-slate-700" htmlFor="identifier">
            {mode === 'supabase' ? 'Email' : 'Username'}
          </label>
          <input
            id="identifier"
            name="identifier"
            type={mode === 'supabase' ? 'email' : 'text'}
            required
            autoComplete={mode === 'supabase' ? 'email' : 'username'}
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value)
              if (error) {
                setError(null)
              }
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder={mode === 'supabase' ? 'you@example.com' : 'Enter your username'}
            disabled={mode === 'supabase' && isAuthenticated}
          />
        </div>
        <div className="space-y-1 text-left">
          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (error) {
                setError(null)
              }
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="••••••••"
            disabled={mode === 'supabase' && isAuthenticated}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || (mode === 'supabase' && isAuthenticated)}
          className="w-full rounded-lg bg-primary-500 px-4 py-2 text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Signing in…' : 'Continue'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500">
        {mode === 'supabase'
          ? 'Use the Supabase email and password configured in your profile settings.'
          : 'Demo access only. Use the provided credentials to explore the app.'}
      </p>
    </section>
  )
}

export default Login
