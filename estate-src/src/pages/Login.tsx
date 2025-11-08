import { FormEvent } from 'react'

const Login = () => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
        <div className="space-y-1 text-left">
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="you@example.com"
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
        New to Estate? Contact your advisor to set up access.
      </p>
    </section>
  )
}

export default Login
