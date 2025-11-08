import { Link } from 'react-router-dom'

const NotFound = () => {
  return (
    <section className="mx-auto max-w-xl space-y-6 text-center">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">404</p>
        <h1 className="text-3xl font-semibold text-slate-900">Page not found</h1>
        <p className="text-sm text-slate-500">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        to="/dashboard"
        className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-600"
      >
        Go to dashboard
      </Link>
    </section>
  )
}

export default NotFound
