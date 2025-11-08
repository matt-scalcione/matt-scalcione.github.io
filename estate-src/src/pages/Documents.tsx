const Documents = () => {
  const folders = [
    {
      name: 'Estate plans',
      description: 'Trust agreements, wills, and supporting memoranda',
      count: 12,
    },
    {
      name: 'Financial statements',
      description: 'Quarterly updates and investment policy documents',
      count: 18,
    },
    {
      name: 'Insurance',
      description: 'Policies, beneficiary forms, and payment confirmations',
      count: 9,
    },
  ]

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-500">
          Securely store and share estate documentation with your trusted advisors.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {folders.map((folder) => (
          <article
            key={folder.name}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-200 hover:shadow"
          >
            <h2 className="text-lg font-semibold text-slate-900">{folder.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{folder.description}</p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              {folder.count} files
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Documents
