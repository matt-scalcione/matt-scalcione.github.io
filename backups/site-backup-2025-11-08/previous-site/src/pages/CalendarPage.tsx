import React, { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import clsx from 'clsx'
import { useDataContext } from '../context/DataContext'
import { buildMonthMatrix, formatDate, getUpcomingEvents } from '../utils/date'

export const CalendarPage = () => {
  const { calendarEvents } = useDataContext()
  const [reference, setReference] = useState(dayjs())

  const weeks = useMemo(() => buildMonthMatrix(reference), [reference])
  const monthEvents = useMemo(
    () =>
      calendarEvents.filter((event) => dayjs(event.date).isSame(reference, 'month')),
    [calendarEvents, reference]
  )
  const upcoming = useMemo(() => getUpcomingEvents(calendarEvents, 120), [calendarEvents])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof monthEvents>()
    monthEvents.forEach((event) => {
      const dateKey = dayjs(event.date).format('YYYY-MM-DD')
      const list = map.get(dateKey) ?? []
      list.push(event)
      map.set(dateKey, list)
    })
    return map
  }, [monthEvents])

  const changeMonth = (offset: number) => {
    setReference((prev) => prev.add(offset, 'month'))
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Estate calendar</h2>
          <p className="text-sm text-slate-500">Track statutory deadlines and task milestones.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => changeMonth(-1)}>
            Previous
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setReference(dayjs())}>
            Today
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => changeMonth(1)}>
            Next
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-semibold">{reference.format('MMMM YYYY')}</h3>
          <p className="text-sm text-slate-500">
            {monthEvents.length} scheduled {monthEvents.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="bg-slate-100 py-2 text-center text-xs font-semibold uppercase tracking-wide dark:bg-slate-900">
              {day}
            </div>
          ))}
          {weeks.map((week, index) => (
            <React.Fragment key={index}>
              {week.map((date) => {
                const key = date.format('YYYY-MM-DD')
                const isCurrentMonth = date.isSame(reference, 'month')
                const events = eventsByDate.get(key) ?? []
                return (
                  <div
                    key={key}
                    className={clsx(
                      'min-h-[110px] border border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900',
                      !isCurrentMonth && 'bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={clsx('font-semibold', date.isSame(dayjs(), 'day') && 'text-brand-600 dark:text-brand-400')}>
                        {date.date()}
                      </span>
                      {events.length > 0 && (
                        <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:bg-brand-400/20 dark:text-brand-200">
                          {events.length}
                        </span>
                      )}
                    </div>
                    <ul className="mt-2 space-y-1">
                      {events.slice(0, 3).map((event) => (
                        <li
                          key={event.id}
                          className={clsx(
                            'rounded-md px-2 py-1 text-[11px] font-medium',
                            event.type === 'Deadline'
                              ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200'
                              : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200'
                          )}
                        >
                          {event.title}
                        </li>
                      ))}
                      {events.length > 3 && (
                        <li className="text-[10px] text-slate-500">+{events.length - 3} more…</li>
                      )}
                    </ul>
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Upcoming items</h3>
          </div>
          <div className="card-body">
            <ul className="space-y-3 text-sm">
              {upcoming.length === 0 && <li className="text-slate-500">No items in the next 120 days.</li>}
              {upcoming.map((event) => (
                <li key={event.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-xs text-slate-500">{event.type === 'Deadline' ? 'Statutory deadline' : 'Task due date'}</p>
                  </div>
                  <span className="font-semibold">{formatDate(event.date)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Today</h3>
          </div>
          <div className="card-body">
            <ul className="space-y-2 text-sm">
              {calendarEvents.filter((event) => dayjs(event.date).isSame(dayjs(), 'day')).map((event) => (
                <li key={event.id} className="rounded-lg bg-brand-500/10 px-3 py-2 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
                  {event.title}
                </li>
              ))}
              {calendarEvents.filter((event) => dayjs(event.date).isSame(dayjs(), 'day')).length === 0 && (
                <li className="text-slate-500">No items scheduled for today.</li>
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
