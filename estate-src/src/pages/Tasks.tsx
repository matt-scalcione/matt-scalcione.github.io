const Tasks = () => {
  const tasks = [
    { title: 'Review beneficiary designations', status: 'Due May 12' },
    { title: 'Upload updated household inventory', status: 'Due May 18' },
    { title: 'Sign durable power of attorney', status: 'Awaiting signature' },
    { title: 'Schedule family meeting', status: 'Draft agenda in progress' },
  ]

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Tasks</h1>
        <p className="text-sm text-slate-500">
          Track outstanding deliverables and collaborate with your planning team.
        </p>
      </header>
      <div className="space-y-4">
        {tasks.map((task) => (
          <article
            key={task.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-200 hover:shadow"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>
              <span className="text-sm font-medium text-primary-600">{task.status}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Tasks
