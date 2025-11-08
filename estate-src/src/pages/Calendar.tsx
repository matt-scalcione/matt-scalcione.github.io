const Calendar = () => {
  const events = [
    { date: 'May 10', title: 'Family governance workshop', location: 'Conference room B' },
    { date: 'May 18', title: 'Investment committee briefing', location: 'Virtual meeting' },
    { date: 'May 24', title: 'Annual estate review', location: 'Advisor office' },
  ]

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Calendar</h1>
        <p className="text-sm text-slate-500">
          Coordinate upcoming meetings, reviews, and family touchpoints.
        </p>
      </header>
      <div className="space-y-4">
        {events.map((event) => (
          <article
            key={event.title}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-200 hover:shadow md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">{event.date}</p>
              <h2 className="text-lg font-semibold text-slate-900">{event.title}</h2>
            </div>
            <p className="text-sm text-slate-600">{event.location}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Calendar
