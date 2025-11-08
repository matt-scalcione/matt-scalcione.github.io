const Dashboard = () => {
  const highlights = [
    {
      title: 'Upcoming review',
      description: 'Annual estate plan review scheduled for May 24 at 2:00 PM.',
    },
    {
      title: 'Recent activity',
      description: 'Two new documents were uploaded by your attorney last week.',
    },
    {
      title: 'Open tasks',
      description: '4 action items assigned to you are due this month.',
    },
  ]

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-primary-600">Overview</p>
        <h1 className="text-3xl font-semibold text-slate-900">Your estate at a glance</h1>
        <p className="text-sm text-slate-500">
          Stay ahead of important deadlines, documents, and family conversations with a single
          command center.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-200 hover:shadow"
          >
            <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Dashboard
