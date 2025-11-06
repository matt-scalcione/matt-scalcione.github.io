import { FormEvent, useMemo, useState } from 'react'
import Calendar from 'react-calendar'
import dayjs from 'dayjs'
import { FaPlus } from 'react-icons/fa'
import { useDataContext } from '../contexts/DataContext'
import { calculateDeadlines, formatDate } from '../utils/dates'

interface CalendarEvent {
  id: string
  title: string
  description?: string
  date: string
  source: 'task' | 'deadline' | 'manual'
  link?: string
}

type ValuePiece = Date | null

type Value = ValuePiece | [ValuePiece, ValuePiece]

export const CalendarPage = () => {
  const {
    data: { tasks, manualEvents, estateInfo },
    addEvent,
    removeEvent
  } = useDataContext()

  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [form, setForm] = useState({ title: '', date: dayjs().format('YYYY-MM-DD'), description: '', category: '', relatedTaskId: '' })

  const deadlines = calculateDeadlines(estateInfo)

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const items: CalendarEvent[] = []
    tasks
      .filter((task) => task.dueDate)
      .forEach((task) => {
        items.push({
          id: task.id,
          title: task.title,
          date: task.dueDate!,
          description: task.description,
          source: 'task',
          link: '/tasks'
        })
      })

    Object.entries(deadlines)
      .filter(([, date]) => date)
      .forEach(([key, date]) => {
        items.push({
          id: `deadline-${key}`,
          title: deadlineLabels[key as keyof typeof deadlineLabels],
          date: date as string,
          source: 'deadline'
        })
      })

    manualEvents.forEach((event) => {
      items.push({
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date,
        source: 'manual'
      })
    })
    return items
  }, [tasks, manualEvents, deadlines])

  const eventsByDate = useMemo(() => {
    return calendarEvents.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      const key = dayjs(event.date).format('YYYY-MM-DD')
      acc[key] = acc[key] ? [...acc[key], event] : [event]
      return acc
    }, {})
  }, [calendarEvents])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.title || !form.date) return
    addEvent({ title: form.title, description: form.description || undefined, date: form.date, category: form.category || undefined, relatedTaskId: form.relatedTaskId || undefined })
    setForm({ title: '', date: dayjs().format('YYYY-MM-DD'), description: '', category: '', relatedTaskId: '' })
  }

  const selectedKey = selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : undefined
  const selectedEvents = selectedKey ? eventsByDate[selectedKey] ?? [] : []

  return (
    <div className="page calendar">
      <section className="card">
        <div className="section-header">
          <h2>Key Dates & Reminders</h2>
        </div>
        <div className="calendar-grid">
          <Calendar
            value={selectedDate as Value}
            onChange={(value) => {
              const dateValue = Array.isArray(value) ? value[0] : value
              setSelectedDate(dateValue ?? null)
            }}
            tileClassName={({ date }) => {
              const key = dayjs(date).format('YYYY-MM-DD')
              if (!eventsByDate[key]) return undefined
              const types = eventsByDate[key].map((event) => event.source)
              if (types.includes('deadline')) return 'tile-deadline'
              if (types.includes('task')) return 'tile-task'
              return 'tile-manual'
            }}
            tileContent={({ date }) => {
              const key = dayjs(date).format('YYYY-MM-DD')
              const entries = eventsByDate[key]
              return entries ? <span className="tile-count">{entries.length}</span> : null
            }}
          />
          <div className="calendar-details">
            <h3>{selectedKey ? formatDate(selectedKey) : 'Select a date'}</h3>
            {selectedEvents.length === 0 ? (
              <p className="empty">No events logged for this date.</p>
            ) : (
              <ul className="list">
                {selectedEvents.map((event) => (
                  <li key={event.id}>
                    <div>
                      <h4>{event.title}</h4>
                      {event.description && <p>{event.description}</p>}
                      <span className={`badge source-${event.source}`}>{sourceLabel(event.source)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Add Personal Reminder</h2>
        </div>
        <form className="form grid" onSubmit={handleSubmit}>
          <label>
            <span>Title</span>
            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} required />
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} required />
          </label>
          <label>
            <span>Description</span>
            <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} />
          </label>
          <label>
            <span>Category</span>
            <input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              <FaPlus /> Save reminder
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Manual Reminders</h2>
        </div>
        {manualEvents.length === 0 ? (
          <p className="empty">Add reminders for meetings, follow-ups, or other estate-specific appointments.</p>
        ) : (
          <ul className="list">
            {manualEvents
              .slice()
              .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
              .map((event) => (
                <li key={event.id}>
                  <div>
                    <h4>{event.title}</h4>
                    <p>{formatDate(event.date)}</p>
                    {event.description && <p>{event.description}</p>}
                  </div>
                  <button type="button" className="btn link danger" onClick={() => removeEvent(event.id)}>
                    Delete
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const deadlineLabels: Record<string, string> = {
  heirNotice: 'Rule 10.5 heir notices due',
  inventoryDue: 'Inventory filing deadline',
  inheritanceTax: 'Inheritance tax return due',
  inheritanceTaxDiscount: 'Early inheritance tax discount deadline',
  creditorBar: 'Creditor claim period ends'
}

const sourceLabel = (source: CalendarEvent['source']) => {
  switch (source) {
    case 'task':
      return 'Task deadline'
    case 'deadline':
      return 'Statutory deadline'
    case 'manual':
      return 'Personal reminder'
    default:
      return source
  }
}
