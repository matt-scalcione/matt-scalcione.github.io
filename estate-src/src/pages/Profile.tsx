import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createTask, db } from '../storage/tasksDB'
import { EstateSetup, loadEstateSetup, saveEstateSetup } from '../storage/setup'
import { computeDeadlines, formatDeadlineDate, isSetupComplete } from '../utils/deadlines'
import { exportWorkspaceData, importWorkspaceData, type WorkspaceExportPayload } from '../storage/dataTransfer'
import { resetDemoData } from '../storage/demoData'

interface SetupFormState {
  dateOfDeath: string
  lettersGranted: string
  firstPublication: string
  estate1041Required: boolean
}

const toEstateSetup = (state: SetupFormState): EstateSetup => ({
  dateOfDeath: state.dateOfDeath,
  lettersGranted: state.lettersGranted,
  firstPublication: state.firstPublication ? state.firstPublication : null,
  estate1041Required: state.estate1041Required,
})

const defaultFormState: SetupFormState = {
  dateOfDeath: '',
  lettersGranted: '',
  firstPublication: '',
  estate1041Required: true,
}

const Profile = () => {
  const [formState, setFormState] = useState<SetupFormState>(defaultFormState)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateMessage, setGenerateMessage] = useState<string | null>(null)
  const [dataStatusMessage, setDataStatusMessage] = useState<string | null>(null)
  const [dataErrorMessage, setDataErrorMessage] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const hydrateSetup = useCallback(() => {
    const stored = loadEstateSetup()
    if (stored) {
      setFormState({
        dateOfDeath: stored.dateOfDeath,
        lettersGranted: stored.lettersGranted,
        firstPublication: stored.firstPublication || '',
        estate1041Required: stored.estate1041Required,
      })
    } else {
      setFormState(defaultFormState)
    }
  }, [])

  useEffect(() => {
    hydrateSetup()
  }, [hydrateSetup])

  const setup = useMemo(() => {
    const candidate = toEstateSetup(formState)
    return isSetupComplete(candidate) ? candidate : null
  }, [formState])

  const deadlines = useMemo(() => {
    if (!setup) return []
    return computeDeadlines(setup)
  }, [setup])

  const handleFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, type } = event.target
    const value = type === 'checkbox' ? event.target.checked : event.target.value
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }))
    setStatusMessage(null)
    setErrorMessage(null)
    setGenerateMessage(null)
    setDataStatusMessage(null)
    setDataErrorMessage(null)
  }

  const persistSetup = (payload: EstateSetup) => {
    saveEstateSetup(payload)
    setStatusMessage('Saved estate profile settings.')
    setErrorMessage(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.dateOfDeath || !formState.lettersGranted) {
      setErrorMessage('Date of death and letters granted date are required.')
      return
    }
    setIsSaving(true)
    try {
      persistSetup(toEstateSetup(formState))
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateChecklist = async () => {
    setGenerateMessage(null)
    if (!formState.dateOfDeath || !formState.lettersGranted) {
      setErrorMessage('Provide required dates before generating the checklist.')
      return
    }

    const payload = toEstateSetup(formState)
    persistSetup(payload)

    const computed = computeDeadlines(payload).filter((deadline) => deadline.dueDate)

    if (computed.length === 0) {
      setGenerateMessage('Nothing to create yet—add more dates above.')
      return
    }

    setIsGenerating(true)
    try {
      const existing = await db.tasks.toArray()
      const existingTitles = new Set(existing.map((task) => task.title.toLowerCase()))

      let created = 0
      let skipped = 0

      for (const deadline of computed) {
        if (existingTitles.has(deadline.title.toLowerCase())) {
          skipped += 1
          continue
        }

        if (!deadline.dueDate) {
          skipped += 1
          continue
        }

        await createTask({
          title: deadline.title,
          description: deadline.description ?? '',
          due_date: deadline.dueDate.toISOString(),
          status: 'not-started',
          priority: 'med',
          tags: [deadline.tag],
          docIds: [],
        })
        created += 1
        existingTitles.add(deadline.title.toLowerCase())
      }

      setGenerateMessage(
        created > 0
          ? `Generated ${created} task${created === 1 ? '' : 's'}${
              skipped > 0 ? ` (skipped ${skipped} existing reminder${skipped === 1 ? '' : 's'})` : ''
            }.`
          : 'All default tasks already exist.',
      )
      setErrorMessage(null)
    } catch (error) {
      console.error(error)
      setErrorMessage('Unable to generate checklist tasks.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportData = async () => {
    setDataStatusMessage(null)
    setDataErrorMessage(null)
    setIsExporting(true)

    try {
      const payload = await exportWorkspaceData()
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0]
      anchor.href = objectUrl
      anchor.download = `estate-workspace-${timestamp}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      setDataStatusMessage('Exported workspace data. Check your downloads folder for the JSON file.')
    } catch (error) {
      console.error(error)
      setDataErrorMessage('Unable to export workspace data.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => {
    setDataStatusMessage(null)
    setDataErrorMessage(null)
    importInputRef.current?.click()
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return

    setIsImporting(true)
    setDataStatusMessage(null)
    setDataErrorMessage(null)

    try {
      const content = await file.text()
      const parsed = JSON.parse(content) as WorkspaceExportPayload
      await importWorkspaceData(parsed)
      hydrateSetup()
      setStatusMessage('Loaded estate profile from imported data.')
      setGenerateMessage(null)
      setErrorMessage(null)
      setDataStatusMessage('Imported workspace data successfully.')
    } catch (error) {
      console.error(error)
      setDataErrorMessage('Unable to import data. Confirm the file was exported from Estate.')
    } finally {
      setIsImporting(false)
    }
  }

  const handleResetDemoData = async () => {
    setIsResetting(true)
    setDataStatusMessage(null)
    setDataErrorMessage(null)

    try {
      await resetDemoData()
      hydrateSetup()
      setStatusMessage('Loaded demo estate profile.')
      setGenerateMessage(null)
      setErrorMessage(null)
      setDataStatusMessage('Demo data restored. Sample tasks, documents, and journal entries are ready to explore.')
    } catch (error) {
      console.error(error)
      setDataErrorMessage('Unable to reset demo data.')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <section className="space-y-10">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Workspace</p>
        <h1 className="text-3xl font-semibold text-slate-900">Profile &amp; settings</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Capture key docket dates to personalize reminders and manage local data for the Estate demo workspace.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-6">
          <article className="card-surface space-y-6">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Estate timeline</h2>
              <p className="text-sm text-slate-500">
                Enter milestone dates to unlock recommended reminders and populate the checklist with suggested tasks.
              </p>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="dateOfDeath" className="text-sm font-semibold text-slate-700">
                    Date of death
                  </label>
                  <input
                    id="dateOfDeath"
                    name="dateOfDeath"
                    type="date"
                    required
                    value={formState.dateOfDeath}
                    onChange={handleFormChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm transition focus:border-primary-400"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="lettersGranted" className="text-sm font-semibold text-slate-700">
                    Letters granted
                  </label>
                  <input
                    id="lettersGranted"
                    name="lettersGranted"
                    type="date"
                    required
                    value={formState.lettersGranted}
                    onChange={handleFormChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm transition focus:border-primary-400"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="firstPublication" className="text-sm font-semibold text-slate-700">
                    First publication (optional)
                  </label>
                  <input
                    id="firstPublication"
                    name="firstPublication"
                    type="date"
                    value={formState.firstPublication}
                    onChange={handleFormChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm transition focus:border-primary-400"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <label htmlFor="estate1041Required" className="flex items-start gap-3 text-sm text-slate-700">
                    <input
                      id="estate1041Required"
                      name="estate1041Required"
                      type="checkbox"
                      checked={formState.estate1041Required}
                      onChange={handleFormChange}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600"
                    />
                    <span>
                      Estate expects to file Form 1041
                      <span className="mt-1 block text-xs text-slate-500">
                        Uncheck if the estate has no fiduciary income tax filing obligation.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? 'Saving…' : 'Save setup'}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateChecklist}
                  disabled={isGenerating}
                  className="rounded-full border border-primary-200 bg-primary-50 px-5 py-2.5 text-sm font-semibold text-primary-700 transition hover:border-primary-300 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isGenerating ? 'Creating…' : 'Generate default checklist'}
                </button>
              </div>

              {statusMessage && <p className="text-sm text-emerald-600">{statusMessage}</p>}
              {generateMessage && <p className="text-sm text-primary-700">{generateMessage}</p>}
              {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}
            </form>
          </article>

          <article className="card-surface space-y-6">
            <header className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Workspace data</h2>
              <p className="text-sm text-slate-500">
                Export your tasks, document metadata and files, journal entries, and estate profile—or restore the built-in demo content.
              </p>
            </header>

            <div className="space-y-4">
              <p className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600">
                Exports are saved as a JSON file that you can re-import later. Imports replace the data currently stored on this device.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isExporting ? 'Preparing export…' : 'Export workspace'}
                </button>
                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="rounded-full border border-primary-200 bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isImporting ? 'Importing…' : 'Import from file'}
                </button>
                <button
                  type="button"
                  onClick={handleResetDemoData}
                  disabled={isResetting}
                  className="rounded-full border border-slate-300 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isResetting ? 'Restoring…' : 'Reset demo data'}
                </button>
              </div>
              {dataStatusMessage && <p className="text-sm text-emerald-600">{dataStatusMessage}</p>}
              {dataErrorMessage && <p className="text-sm text-rose-600">{dataErrorMessage}</p>}
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFileChange}
            />
          </article>
        </div>

        <article className="card-surface space-y-6">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-900">Suggested due dates</h2>
            <p className="text-sm text-slate-500">
              Deadlines adjust automatically based on the dates provided. Generate the checklist to add them as tasks with workstream tags.
            </p>
          </header>

          {deadlines.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-500">
              Add the date of death and letters granted to preview recommended deadlines.
            </p>
          ) : (
            <ul className="space-y-4">
              {deadlines.map((deadline) => (
                <li
                  key={deadline.key}
                  className="rounded-2xl border border-slate-200 p-4 text-sm shadow-sm transition hover:border-primary-200/70"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{deadline.title}</p>
                      <p className="text-xs uppercase tracking-wide text-primary-600">{deadline.tag}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        deadline.dueDate ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {formatDeadlineDate(deadline.dueDate)}
                    </span>
                  </div>
                  {deadline.description && (
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">{deadline.description}</p>
                  )}
                  {deadline.optional && !deadline.dueDate && (
                    <p className="mt-3 text-xs font-medium text-amber-600">Marked as not applicable.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  )
}


export default Profile
