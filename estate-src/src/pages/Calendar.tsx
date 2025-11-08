import { useEffect, useMemo, useState } from 'react'
import { liveQuery, type Subscription } from 'dexie'
import { db, seedTasksIfEmpty, type TaskRecord } from '../storage/tasksDB'
import { useEstate } from '../context/EstateContext'

type CalendarDay = {
  date: Date
  key: string
  label: string
  isCurrentMonth: boolean
  isToday: boolean
}

const startOfDay = (value: Date) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const toDateKey = (value: Date) => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fromDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

const isSameDay = (a: Date, b: Date) => toDateKey(a) === toDateKey(b)

const getCalendarDays = (currentMonth: Date): CalendarDay[] => {
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

  const startDate = new Date(firstDayOfMonth)
  startDate.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())

  const endDate = new Date(lastDayOfMonth)
  endDate.setDate(lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()))

  const today = startOfDay(new Date())
  const days: CalendarDay[] = []

  for (let date = startDate; date <= endDate; date.setDate(date.getDate() + 1)) {
    const current = new Date(date)
    days.push({
      date: current,
      key: toDateKey(current),
      label: `${current.getDate()}`,
      isCurrentMonth:
        current.getMonth() === currentMonth.getMonth() &&
        current.getFullYear() === currentMonth.getFullYear(),
      isToday: isSameDay(current, today),
    })
  }

  return days
}

const formatDueDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

const formatSelectedDate = (key: string) =>
  fromDateKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const Calendar = () => {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()))
  const { activeEstateId } = useEstate()

  useEffect(() => {
    let isMounted = true
    let subscription: Subscription | undefined

    const initialize = async () => {
      try {
        await seedTasksIfEmpty()
        subscription = liveQuery(() =>
          db.tasks
            .where('estateId')
            .equals(activeEstateId)
            .toArray(),
        ).subscribe({
          next: (rows) => {
            if (!isMounted) return
            const sorted = [...rows].sort(
              (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
            )
            setTasks(sorted)
          },
          error: (err) => {
            console.error(err)
          },
        })
      } catch (error) {
        console.error(error)
      }
    }

    void initialize()

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [activeEstateId])

  const actionableTasks = useMemo(
    () => tasks.filter((task) => task.due_date && task.status !== 'done'),
    [tasks],
  )

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskRecord[]>()
    actionableTasks.forEach((task) => {
      if (!task.due_date) return
      const key = toDateKey(new Date(task.due_date))
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)?.push(task)
    })
    return map
  }, [actionableTasks])

  const calendarDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth])

  const selectedTasks = useMemo(() => {
    const items = tasksByDate.get(selectedDateKey) ?? []
    return [...items].sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    )
  }, [tasksByDate, selectedDateKey])

  const today = useMemo(() => startOfDay(new Date()), [])
  const sevenDaysOut = useMemo(() => addDays(today, 6), [today])
  const thirtyDaysOut = useMemo(() => addDays(today, 29), [today])

  const upcoming7Days = useMemo(
    () =>
      actionableTasks
        .filter((task) => {
          const dueDate = startOfDay(new Date(task.due_date))
          return dueDate >= today && dueDate <= sevenDaysOut
        })
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [actionableTasks, sevenDaysOut, today],
  )

  const upcoming30Days = useMemo(
    () =>
      actionableTasks
        .filter((task) => {
          const dueDate = startOfDay(new Date(task.due_date))
          return dueDate > sevenDaysOut && dueDate <= thirtyDaysOut
        })
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [actionableTasks, sevenDaysOut, thirtyDaysOut],
  )

  const handleSelectDay = (key: string) => {
    setSelectedDateKey(key)
  }

  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">Calendar</h1>
        <p className="text-sm text-slate-500">
          Monitor due dates across the family office and surface upcoming priorities.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreviousMonth}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-primary-200 hover:text-primary-600"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-primary-200 hover:text-primary-600"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
                <div key={weekday} className="py-2">
                  {weekday}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-sm">
              {calendarDays.map((day) => {
                const dueCount = tasksByDate.get(day.key)?.length ?? 0
                const isSelected = selectedDateKey === day.key

                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => handleSelectDay(day.key)}
                    className={`flex h-20 flex-col justify-between rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${
                      isSelected
                        ? 'border-primary-400 bg-primary-50'
                        : day.isCurrentMonth
                          ? 'border-transparent bg-white'
                          : 'border-transparent bg-slate-50 text-slate-400'
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        day.isToday ? 'text-primary-600' : ''
                      }`}
                    >
                      {day.label}
                    </span>
                    {dueCount > 0 && (
                      <span className="inline-flex min-w-[2rem] justify-center rounded-full bg-primary-100 px-2 py-1 text-xs font-semibold text-primary-700">
                        {dueCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{formatSelectedDate(selectedDateKey)}</h2>
              <p className="text-sm text-slate-500">Tasks scheduled for this day.</p>
            </header>

            {selectedTasks.length === 0 ? (
              <p className="text-sm text-slate-500">No outstanding tasks for this date.</p>
            ) : (
              <ul className="space-y-4">
                {selectedTasks.map((task) => (
                  <li key={task.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-primary-600">
                        {formatDueDate(task.due_date)}
                      </p>
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {task.priority === 'high'
                          ? 'High priority'
                          : task.priority === 'med'
                            ? 'Medium priority'
                            : 'Low priority'}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">{task.title}</h3>
                    {task.description && (
                      <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                    )}
                    {task.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {task.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Upcoming 7 days</h2>
              <p className="text-sm text-slate-500">Next week&apos;s deadlines at a glance.</p>
            </header>
            {upcoming7Days.length === 0 ? (
              <p className="text-sm text-slate-500">No due tasks in the next 7 days.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming7Days.map((task) => (
                  <li key={task.id} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                      {formatDueDate(task.due_date)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{task.title}</p>
                    {task.tags.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">{task.tags.join(', ')}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Upcoming 30 days</h2>
              <p className="text-sm text-slate-500">Keep an eye on longer horizon deadlines.</p>
            </header>
            {upcoming30Days.length === 0 ? (
              <p className="text-sm text-slate-500">No due tasks in the next 30 days.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming30Days.map((task) => (
                  <li key={task.id} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                      {formatDueDate(task.due_date)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{task.title}</p>
                    {task.tags.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">{task.tags.join(', ')}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

export default Calendar
