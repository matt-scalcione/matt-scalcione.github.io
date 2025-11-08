import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { liveQuery, type Subscription } from 'dexie'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  DocumentRecord,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  createTask,
  deleteTask,
  linkDocumentToTask,
  seedTasksIfEmpty,
  unlinkDocumentFromTask,
  updateTask,
  db,
} from '../storage/tasksDB'

const priorityStyles: Record<TaskPriority, string> = {
  low: 'bg-emerald-100 text-emerald-700',
  med: 'bg-amber-100 text-amber-700',
  high: 'bg-rose-100 text-rose-700',
}

const statusLabels: Record<TaskStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  done: 'Completed',
}

const startOfToday = () => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

const addDays = (date: Date, days: number) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

const toLocalDateInput = (iso: string) => {
  if (!iso) return ''
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseList = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const formatDueDate = (iso: string) => {
  if (!iso) return 'No due date'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatBytes = (size: number) => {
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  const value = size / 1024 ** exponent
  const formatted = exponent === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${formatted} ${units[exponent]}`
}

type TaskFormState = {
  title: string
  description: string
  due_date: string
  status: TaskStatus
  priority: TaskPriority
  tags: string
}

const emptyFormState: TaskFormState = {
  title: '',
  description: '',
  due_date: '',
  status: 'not-started',
  priority: 'med',
  tags: '',
}

const createFormState = (task?: TaskRecord): TaskFormState =>
  task
    ? {
        title: task.title,
        description: task.description,
        due_date: toLocalDateInput(task.due_date),
        status: task.status,
        priority: task.priority,
        tags: task.tags.join(', '),
      }
    : { ...emptyFormState }

const Tasks = () => {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [tagFilter, setTagFilter] = useState('all')
  const [isCreating, setIsCreating] = useState(false)
  const [formState, setFormState] = useState<TaskFormState>({ ...emptyFormState })
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [docToLink, setDocToLink] = useState('')
  const [linking, setLinking] = useState(false)
  const [unlinkingDocId, setUnlinkingDocId] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const { taskId } = useParams<{ taskId?: string }>()

  const selectedTask = tasks.find((task) => task.id === taskId) || null

  useEffect(() => {
    let isMounted = true
    let subscription: Subscription | undefined

    const initialize = async () => {
      try {
        await seedTasksIfEmpty()
        subscription = liveQuery(() => db.tasks.toArray()).subscribe({
          next: (rows) => {
            if (!isMounted) return
            const sorted = [...rows].sort((a, b) =>
              new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
            )
            setTasks(sorted)
            setLoading(false)
          },
          error: (err) => {
            console.error(err)
            if (!isMounted) return
            setError('Unable to load tasks')
            setLoading(false)
          },
        })
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        setError('Unable to load tasks')
        setLoading(false)
      }
    }

    initialize()

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let subscription: Subscription | undefined

    subscription = liveQuery(() => db.documents.toArray()).subscribe({
      next: (rows) => {
        if (!isMounted) return
        const sorted = [...rows].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        setDocuments(sorted)
      },
      error: (err) => {
        console.error(err)
        if (!isMounted) return
        setError('Unable to load documents')
      },
    })

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!taskId || tasks.some((task) => task.id === taskId)) return
    navigate('/tasks', { replace: true })
  }, [taskId, tasks, navigate])

  useEffect(() => {
    const state = location.state as { startCreate?: boolean } | null
    if (!state?.startCreate) return

    setError(null)
    setFormState({ ...emptyFormState })
    setIsCreating(true)
    navigate(location.pathname + location.search, { replace: true })
  }, [location, navigate])

  const tags = useMemo(() => {
    const unique = new Set<string>()
    tasks.forEach((task) => task.tags.forEach((tag) => unique.add(tag)))
    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!showCompleted && task.status === 'done') {
        return false
      }
      if (tagFilter !== 'all' && !task.tags.includes(tagFilter)) {
        return false
      }
      return true
    })
  }, [tasks, showCompleted, tagFilter])

  const linkedDocuments = useMemo(() => {
    if (!selectedTask) return []
    const docIdSet = new Set(selectedTask.docIds)
    return documents.filter(
      (doc) => doc.taskId === selectedTask.id || docIdSet.has(doc.id),
    )
  }, [documents, selectedTask])

  const availableDocuments = useMemo(
    () => documents.filter((doc) => !doc.taskId),
    [documents],
  )

  const handleSelectTask = (id: string) => {
    navigate(`/tasks/${id}`)
  }

  const handleFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const resetForm = () => {
    setFormState({ ...emptyFormState })
    setFormSubmitting(false)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formState.title || !formState.due_date) {
      setError('Title and due date are required')
      return
    }
    setError(null)
    setFormSubmitting(true)
    try {
      const id = await createTask({
        title: formState.title,
        description: formState.description,
        due_date: formState.due_date,
        status: formState.status,
        priority: formState.priority,
        tags: parseList(formState.tags),
      })
      resetForm()
      setIsCreating(false)
      navigate(`/tasks/${id}`)
    } catch (err) {
      console.error(err)
      setError('Unable to save task')
      setFormSubmitting(false)
    }
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTask) return
    if (!formState.title || !formState.due_date) {
      setError('Title and due date are required')
      return
    }
    setError(null)
    setFormSubmitting(true)
    try {
      await updateTask(selectedTask.id, {
        title: formState.title,
        description: formState.description,
        due_date: formState.due_date,
        status: formState.status,
        priority: formState.priority,
        tags: parseList(formState.tags),
      })
      setFormSubmitting(false)
    } catch (err) {
      console.error(err)
      setError('Unable to update task')
      setFormSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      await deleteTask(id)
      if (taskId === id) {
        navigate('/tasks')
      }
    } catch (err) {
      console.error(err)
      setError('Unable to delete task')
    }
  }

  const handleMarkDone = async (task: TaskRecord) => {
    setError(null)
    try {
      await updateTask(task.id, { status: 'done' })
    } catch (err) {
      console.error(err)
      setError('Unable to update task status')
    }
  }

  const handleLinkDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTask || !docToLink) return
    setError(null)
    setLinking(true)
    try {
      await linkDocumentToTask(docToLink, selectedTask.id)
      setDocToLink('')
    } catch (err) {
      console.error(err)
      setError('Unable to link document')
    } finally {
      setLinking(false)
    }
  }

  const handleUnlinkDocument = async (docId: string) => {
    setError(null)
    setUnlinkingDocId(docId)
    try {
      await unlinkDocumentFromTask(docId)
    } catch (err) {
      console.error(err)
      setError('Unable to unlink document')
    } finally {
      setUnlinkingDocId(null)
    }
  }

  const handleStartCreate = () => {
    resetForm()
    setIsCreating(true)
    navigate('/tasks')
  }

  const handleStartEdit = () => {
    if (!selectedTask) return
    setFormState(createFormState(selectedTask))
    setIsCreating(false)
  }

  useEffect(() => {
    if (selectedTask) {
      setFormState(createFormState(selectedTask))
    } else {
      setFormState({ ...emptyFormState })
    }
    setDocToLink('')
  }, [selectedTask])

  const today = useMemo(() => startOfToday(), [])
  const upcomingThreshold = useMemo(() => addDays(today, 7), [today])

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Tasks</h1>
        <p className="text-sm text-slate-500">
          Track outstanding deliverables, collaborate with your team, and keep estate planning work moving.
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-1/2">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleStartCreate}
              className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-500"
            >
              New Task
            </button>
            <button
              type="button"
              onClick={() => setShowCompleted((prev) => !prev)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                showCompleted
                  ? 'border-primary-200 bg-primary-50 text-primary-700'
                  : 'border-slate-200 text-slate-600 hover:border-primary-200 hover:text-primary-600'
              }`}
            >
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <label htmlFor="tag-filter" className="font-medium">
                Tag
              </label>
              <select
                id="tag-filter"
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
              >
                <option value="all">All</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {loading && <p className="text-sm text-slate-500">Loading tasks…</p>}
            {error && !loading && <p className="text-sm text-rose-600">{error}</p>}
            {!loading && filteredTasks.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No tasks match the selected filters yet.
              </p>
            )}
            {filteredTasks.map((task) => {
              const dueDate = new Date(task.due_date)
              const isOverdue = task.status !== 'done' && dueDate < today
              const isDueSoon = !isOverdue && task.status !== 'done' && dueDate <= upcomingThreshold

              return (
                <article
                  key={task.id}
                  className={`rounded-2xl border p-5 shadow-sm transition hover:border-primary-200 hover:shadow-md ${
                    taskId === task.id ? 'border-primary-300 bg-primary-50/40' : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectTask(task.id)}
                    className="flex w-full flex-col gap-3 text-left"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>
                        <p className="text-sm text-slate-500">{statusLabels[task.status]}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${priorityStyles[task.priority]}`}
                      >
                        {task.priority === 'med' ? 'Medium' : task.priority === 'low' ? 'Low' : 'High'} priority
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span
                        className={`rounded-full px-3 py-1 ${
                          isOverdue
                            ? 'bg-rose-100 text-rose-700'
                            : isDueSoon
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Due {formatDueDate(task.due_date)}
                      </span>
                      {task.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </button>
                </article>
              )
            })}
          </div>
        </div>

        <div className="lg:w-1/2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {isCreating ? (
              <div className="space-y-4">
                <header className="space-y-1">
                  <h2 className="text-xl font-semibold text-slate-900">Create task</h2>
                  <p className="text-sm text-slate-500">Add a new deliverable to your estate planning pipeline.</p>
                </header>
                <form className="space-y-4" onSubmit={handleCreate}>
                  <TaskFormFields
                    formState={formState}
                    submitting={formSubmitting}
                    onChange={handleFormChange}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {formSubmitting ? 'Saving…' : 'Save task'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetForm()
                        setIsCreating(false)
                      }}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedTask ? (
              <div className="space-y-4">
                <header className="space-y-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">{selectedTask.title}</h2>
                      <p className="text-sm text-slate-500">Due {formatDueDate(selectedTask.due_date)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedTask.id)}
                      className="text-sm font-medium text-rose-600 transition hover:text-rose-500"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    <span className={`rounded-full px-3 py-1 ${priorityStyles[selectedTask.priority]}`}>
                      {selectedTask.priority === 'med'
                        ? 'Medium'
                        : selectedTask.priority === 'low'
                        ? 'Low'
                        : 'High'}{' '}
                      priority
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      {statusLabels[selectedTask.status]}
                    </span>
                  </div>
                </header>

                <p className="text-sm text-slate-600">{selectedTask.description || 'No description provided yet.'}</p>

                {selectedTask.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                    {selectedTask.tags.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => {
                          setTagFilter(tag)
                          navigate('/tasks')
                        }}
                        className={`rounded-full border px-3 py-1 transition hover:border-primary-200 hover:text-primary-600 ${
                          tagFilter === tag ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

                {linkedDocuments.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700">Linked documents</h3>
                    <ul className="space-y-2">
                      {linkedDocuments.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <Link
                              to={`/documents?highlight=${encodeURIComponent(doc.id)}`}
                              className="block truncate text-sm font-medium text-primary-600 hover:underline"
                            >
                              {doc.title || 'Untitled document'}
                            </Link>
                            <p className="text-xs text-slate-500">
                              {doc.contentType.includes('pdf')
                                ? 'PDF'
                                : doc.contentType.startsWith('image/')
                                ? 'Image'
                                : doc.contentType.includes('text')
                                ? 'Text'
                                : 'Document'}{' '}
                              • {formatBytes(doc.size)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnlinkDocument(doc.id)}
                            disabled={unlinkingDocId === doc.id}
                            className="text-xs font-medium text-rose-600 transition hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {unlinkingDocId === doc.id ? 'Unlinking…' : 'Unlink'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">Link a document</h3>
                  {availableDocuments.length > 0 ? (
                    <form className="flex flex-wrap items-center gap-2" onSubmit={handleLinkDocument}>
                      <select
                        value={docToLink}
                        onChange={(event) => setDocToLink(event.target.value)}
                        disabled={linking}
                        className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
                      >
                        <option value="">Select document</option>
                        {availableDocuments.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.title || 'Untitled document'} ({formatBytes(doc.size)})
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={!docToLink || linking}
                        className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {linking ? 'Linking…' : 'Link'}
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs text-slate-500">
                      All documents are currently linked. Manage files from the Documents page.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {selectedTask.status !== 'done' && (
                    <button
                      type="button"
                      onClick={() => handleMarkDone(selectedTask)}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      Mark Done
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/tasks')}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                  >
                    Close
                  </button>
                </div>

                <form className="space-y-4" onSubmit={handleEdit}>
                  <TaskFormFields
                    formState={formState}
                    submitting={formSubmitting}
                    onChange={handleFormChange}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {formSubmitting ? 'Saving…' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormState(createFormState(selectedTask))}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-primary-200 hover:text-primary-600"
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4 text-sm text-slate-500">
                <h2 className="text-xl font-semibold text-slate-900">Select a task</h2>
                <p>
                  Choose a task from the list to view its details, update progress, or link related documents. Create a
                  new task to capture upcoming work for your estate plan.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

type TaskFormFieldsProps = {
  formState: TaskFormState
  submitting: boolean
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
}

const TaskFormFields = ({ formState, submitting, onChange }: TaskFormFieldsProps) => {
  return (
    <>
      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium text-slate-700">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          value={formState.title}
          disabled={submitting}
          onChange={onChange}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="description" className="text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={formState.description}
          disabled={submitting}
          onChange={onChange}
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="due_date" className="text-sm font-medium text-slate-700">
            Due date
          </label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            required
            value={formState.due_date}
            disabled={submitting}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="status" className="text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formState.status}
            disabled={submitting}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
          >
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="priority" className="text-sm font-medium text-slate-700">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            value={formState.priority}
            disabled={submitting}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
          >
            <option value="low">Low</option>
            <option value="med">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="tags" className="text-sm font-medium text-slate-700">
            Tags (comma separated)
          </label>
          <input
            id="tags"
            name="tags"
            value={formState.tags}
            disabled={submitting}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none"
          />
        </div>
      </div>
    </>
  )
}


export default Tasks
