const Profile = () => {
  const info = {
    name: 'Alex Morgan',
    role: 'Family Steward',
    email: 'alex.morgan@example.com',
    phone: '(555) 123-4567',
    advisor: 'Jordan Blake',
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500">
          Update your contact details and manage access for your planning team.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Primary contact</h2>
            <p className="mt-2 text-xl font-semibold text-slate-900">{info.name}</p>
            <p className="text-sm text-slate-500">{info.role}</p>
          </div>
          <dl className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-slate-500">Email</dt>
              <dd>{info.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-slate-500">Phone</dt>
              <dd>{info.phone}</dd>
            </div>
          </dl>
        </article>
        <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lead advisor</h2>
          <p className="text-lg font-semibold text-slate-900">{info.advisor}</p>
          <p className="text-sm text-slate-600">
            Reach out to your advisor to coordinate document updates or schedule a planning session.
          </p>
          <button className="w-full rounded-lg border border-primary-200 px-4 py-2 text-sm font-semibold text-primary-600 transition hover:border-primary-300 hover:text-primary-700">
            Message advisor
          </button>
        </article>
      </div>
    </section>
  )
}

export default Profile
