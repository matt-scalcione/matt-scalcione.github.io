import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Login = () => {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      login(username, password)
      navigate('/dashboard', { replace: true })
    } catch (loginError) {
      console.error(loginError)
      setError('Invalid username or password. Please try again.')
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6 rounded-2xl bg-white p-8 shadow-sm">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-slate-900">Sign in</h1>
        <p className="text-sm text-slate-500">
          Access your estate planning tools and stay on top of upcoming tasks.
        </p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <div className="space-y-1 text-left">
          <label className="block text-sm font-medium text-slate-700" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
              if (error) {
                setError(null)
              }
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="Enter your username"
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
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-primary-500 px-4 py-2 text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2"
        >
          Continue
        </button>
      </form>
      <p className="text-center text-sm text-slate-500">
        Demo access only. Use the provided credentials to explore the app.
      </p>
    </section>
  )
}

export default Login
