import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntries,
  JournalEntryRecord,
  updateJournalEntry,
} from '../storage/tasksDB'

const MAX_ENTRY_LENGTH = 10000

const formatDate = (isoDate: string) => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.valueOf())) return 'Unknown date'
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const Journal = () => {
  const [entries, setEntries] = useState<JournalEntryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({})
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  const bodyCharactersRemaining = useMemo(() => MAX_ENTRY_LENGTH - formBody.length, [formBody.length])

  const loadEntries = async () => {
    const results = await getJournalEntries()
    setEntries(results)
    setIsLoading(false)
  }

  useEffect(() => {
    void loadEntries()
  }, [])

  useEffect(() => {
    const state = location.state as { focusNewEntry?: boolean } | null
    if (!state?.focusNewEntry) return

    setEditingId(null)
    setFormTitle('')
    setFormBody('')
    setError(null)
    titleInputRef.current?.focus()

    navigate(location.pathname + location.search, { replace: true })
  }, [location, navigate])

  const resetForm = () => {
    setFormTitle('')
    setFormBody('')
    setEditingId(null)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = formTitle.trim()
    const trimmedBody = formBody.trim()

    if (!trimmedTitle) {
      setError('Title is required.')
      return
    }

    if (!trimmedBody) {
      setError('Write something in the journal entry before saving.')
      return
    }

    if (trimmedBody.length > MAX_ENTRY_LENGTH) {
      setError(`Journal entries are limited to ${MAX_ENTRY_LENGTH.toLocaleString()} characters.`)
      return
    }

    if (editingId) {
      await updateJournalEntry(editingId, {
        title: trimmedTitle,
        body: trimmedBody,
      })
    } else {
      await createJournalEntry({
        title: trimmedTitle,
        body: trimmedBody,
      })
    }

    resetForm()
    await loadEntries()
  }

  const handleEdit = (entry: JournalEntryRecord) => {
    setEditingId(entry.id)
    setFormTitle(entry.title)
    setFormBody(entry.body)
    setError(null)
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Remove this journal entry? This cannot be undone.')
    if (!confirmed) return

    await deleteJournalEntry(id)
    setExpandedEntries((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await loadEntries()
  }

  const toggleExpanded = (id: string) => {
    setExpandedEntries((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Journal</h1>
        <p className="text-sm text-slate-500">
          Chronicle milestones, conversations, and insights to keep the family aligned.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-2">
          <label htmlFor="journal-title" className="text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            id="journal-title"
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="Entry title"
            value={formTitle}
            onChange={(event) => {
              setFormTitle(event.target.value)
              if (error) setError(null)
            }}
            maxLength={160}
            required
            ref={titleInputRef}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="journal-body" className="text-sm font-medium text-slate-700">
            Entry
          </label>
          <textarea
            id="journal-body"
            className="min-h-[160px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
            placeholder="Capture milestones, reflections, or next steps..."
            value={formBody}
            onChange={(event) => {
              setFormBody(event.target.value.slice(0, MAX_ENTRY_LENGTH))
              if (error) setError(null)
            }}
            maxLength={MAX_ENTRY_LENGTH}
          />
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{bodyCharactersRemaining.toLocaleString()} characters remaining</span>
            {editingId ? <span>Editing existing entry</span> : <span>New entry</span>}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            {editingId ? 'Update entry' : 'Save entry'}
          </button>
          {editingId ? (
            <button
              type="button"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
              onClick={resetForm}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading journal entries…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-500">
            Start documenting the journey—new entries will appear here in newest-first order.
          </p>
        ) : (
          entries.map((entry) => {
            const isExpanded = expandedEntries[entry.id]
            const bodyPreview = isExpanded
              ? entry.body
              : entry.body.length > 280
                ? `${entry.body.slice(0, 280)}…`
                : entry.body

            return (
              <article
                key={entry.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-200 hover:shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                      {formatDate(entry.created_at)}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{entry.title}</h2>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => handleEdit(entry)}
                      className="font-medium text-primary-600 hover:text-primary-700"
                    >
                      Edit
                    </button>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="font-medium text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{bodyPreview}</p>
                {entry.body.length > 280 ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    onClick={() => toggleExpanded(entry.id)}
                  >
                    {isExpanded ? 'Show less' : 'Read more'}
                  </button>
                ) : null}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

export default Journal
