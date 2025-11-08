const Journal = () => {
  const entries = [
    {
      title: 'Legacy interview notes',
      date: 'April 26',
      excerpt: 'Captured reflections from our discussion with the family historian.',
    },
    {
      title: 'Education fund update',
      date: 'April 18',
      excerpt: 'Documented new allocation strategy for next generation scholarships.',
    },
    {
      title: 'Philanthropy workshop',
      date: 'April 9',
      excerpt: 'Summarized commitments and follow-ups from the giving circle session.',
    },
  ]

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Journal</h1>
        <p className="text-sm text-slate-500">
          Chronicle milestones, conversations, and insights to keep the family aligned.
        </p>
      </header>
      <div className="space-y-4">
        {entries.map((entry) => (
          <article
            key={entry.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-200 hover:shadow"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{entry.date}</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{entry.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{entry.excerpt}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Journal
