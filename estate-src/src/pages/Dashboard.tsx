import { useEffect, useMemo, useState } from 'react'
import { liveQuery, type Subscription } from 'dexie'
import { useNavigate } from 'react-router-dom'

import {
  DocumentRecord,
  JournalEntryRecord,
  TaskRecord,
  db,
} from '../storage/tasksDB'
import { useEstate } from '../context/EstateContext'

type TaskMetrics = {
  total: number
  completed: number
  open: number
  progressPercent: number
  overdue: number
  dueThisWeek: number
  tagBreakdown: Array<{ tag: string; count: number }>
  upcomingDeadlines: TaskRecord[]
}

const formatDate = (iso: string) => {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.valueOf())) return 'No due date'
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatDateTime = (iso: string) => {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.valueOf())) return 'Unknown date'
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const Dashboard = () => {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntryRecord[]>([])
  const navigate = useNavigate()
  const { activeEstateId } = useEstate()

  useEffect(() => {
    let isMounted = true
    let subscription: Subscription | undefined

    subscription = liveQuery(() =>
      db.tasks
        .where('estateId')
        .equals(activeEstateId)
        .toArray(),
    ).subscribe({
      next: (rows) => {
        if (!isMounted) return
        const ordered = [...rows].sort(
          (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
        )
        setTasks(ordered)
      },
      error: (err) => {
        console.error(err)
      },
    })

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [activeEstateId])

  useEffect(() => {
    let isMounted = true
    let subscription: Subscription | undefined

    subscription = liveQuery(() =>
      db.documents
        .where('estateId')
        .equals(activeEstateId)
        .toArray(),
    ).subscribe({
      next: (rows) => {
        if (!isMounted) return
        const ordered = [...rows].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        setDocuments(ordered)
      },
      error: (err) => {
        console.error(err)
      },
    })

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [activeEstateId])

  useEffect(() => {
    let isMounted = true
    let subscription: Subscription | undefined

    subscription = liveQuery(() =>
      db.journalEntries
        .where('estateId')
        .equals(activeEstateId)
        .sortBy('created_at'),
    ).subscribe({
      next: (rows) => {
        if (!isMounted) return
        setJournalEntries(rows.slice().reverse())
      },
      error: (err) => {
        console.error(err)
      },
    })

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [activeEstateId])

  const metrics = useMemo<TaskMetrics>(() => {
    const total = tasks.length
    const completed = tasks.filter((task) => task.status === 'done').length
    const open = total - completed
    const progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + 7)

    let overdue = 0
    let dueThisWeek = 0
    const tagCounter = new Map<string, number>()
    const upcoming: TaskRecord[] = []

    tasks.forEach((task) => {
      task.tags.forEach((tag) => {
        tagCounter.set(tag, (tagCounter.get(tag) ?? 0) + 1)
      })

      const dueDate = new Date(task.due_date)
      if (Number.isNaN(dueDate.valueOf())) {
        return
      }

      if (task.status !== 'done') {
        if (dueDate < today) {
          overdue += 1
        } else if (dueDate <= endOfWeek) {
          dueThisWeek += 1
        }

        if (dueDate >= today) {
          upcoming.push(task)
        }
      }
    })

    const tagBreakdown = Array.from(tagCounter.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 10)

    const upcomingDeadlines = upcoming
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 3)

    return { total, completed, open, progressPercent, overdue, dueThisWeek, tagBreakdown, upcomingDeadlines }
  }, [tasks])

  const lastDocument = documents[0] ?? null
  const lastJournalEntry = journalEntries[0] ?? null

  const quickActions = [
    {
      label: 'Add task',
      description: 'Capture a new responsibility and assign an owner and due date.',
      onClick: () => navigate('/tasks', { state: { startCreate: true } }),
    },
    {
      label: 'Upload document',
      description: 'Store signed agreements, statements, and supporting files.',
      onClick: () => navigate('/documents', { state: { startUpload: true } }),
    },
    {
      label: 'New journal entry',
      description: 'Record family updates or decisions for future reference.',
      onClick: () => navigate('/journal', { state: { focusNewEntry: true } }),
    },
  ]

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-primary-600">Overview</p>
        <h1 className="text-3xl font-semibold text-slate-900">Your estate at a glance</h1>
        <p className="text-sm text-slate-500">
          Keep tabs on deadlines, documentation, and notes—everything you need to guide the estate plan forward.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Task progress</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">{metrics.total} tasks</h2>
            </div>
            <span className="text-sm font-semibold text-primary-600">{metrics.progressPercent}% done</span>
          </header>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>{metrics.open} open</span>
              <span>{metrics.completed} completed</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${metrics.progressPercent}%` }}
              />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">Deadlines</p>
            <h2 className="text-xl font-semibold text-slate-900">Upcoming commitments</h2>
          </header>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
              <span>Overdue</span>
              <span className="text-base font-semibold">{metrics.overdue}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
              <span>Due this week</span>
              <span className="text-base font-semibold">{metrics.dueThisWeek}</span>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">Quick actions</p>
            <h2 className="text-xl font-semibold text-slate-900">Jump back in</h2>
          </header>
          <div className="mt-4 space-y-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-primary-200 hover:bg-primary-50/60 hover:text-primary-700"
              >
                <span className="block text-base font-semibold text-slate-900">{action.label}</span>
                <span className="block text-xs text-slate-500">{action.description}</span>
              </button>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Next deadlines</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Coming up</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all tasks
            </button>
          </header>
          <div className="mt-4 space-y-3">
            {metrics.upcomingDeadlines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No upcoming deadlines—review overdue items or add new tasks to see them here.
              </p>
            ) : (
              metrics.upcomingDeadlines.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="text-base font-semibold text-slate-900">{task.title}</p>
                    <p className="text-xs text-slate-500">{task.tags.length ? task.tags.map((tag) => `#${tag}`).join(' • ') : 'No tags'}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Due {formatDate(task.due_date)}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">Recent activity</p>
            <h2 className="text-xl font-semibold text-slate-900">Latest updates</h2>
          </header>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Document</p>
              {lastDocument ? (
                <div className="mt-1 space-y-1">
                  <p className="text-base font-semibold text-slate-900">{lastDocument.title || 'Untitled document'}</p>
                  <p className="text-xs text-slate-500">Uploaded {formatDateTime(lastDocument.created_at)}</p>
                  {lastDocument.tags.length > 0 ? (
                    <p className="text-xs text-slate-500">Tags: {lastDocument.tags.map((tag) => `#${tag}`).join(', ')}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Upload your first document to see it here.</p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Journal</p>
              {lastJournalEntry ? (
                <div className="mt-1 space-y-1">
                  <p className="text-base font-semibold text-slate-900">{lastJournalEntry.title}</p>
                  <p className="text-xs text-slate-500">Last updated {formatDateTime(lastJournalEntry.created_at)}</p>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Capture your first journal entry to see it here.</p>
              )}
            </div>
          </div>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Tags</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Work by category</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/tasks')}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Manage tags
          </button>
        </header>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.tagBreakdown.length === 0 ? (
            <p className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No tags yet—add labels to tasks to organize work by theme.
            </p>
          ) : (
            metrics.tagBreakdown.map((entry) => (
              <div
                key={entry.tag}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-900">#{entry.tag}</p>
                <p className="text-xs text-slate-500">{entry.count} task{entry.count === 1 ? '' : 's'}</p>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  )
}

export default Dashboard
