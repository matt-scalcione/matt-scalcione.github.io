import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFilePdf, faImage, faTasks } from '@fortawesome/free-solid-svg-icons'
import { Link } from 'react-router-dom'
import { useDataContext } from '../context/DataContext'
import { getUpcomingEvents, isDueSoon, isOverdue, formatDate } from '../utils/date'

export const DashboardPage = () => {
  const { tasks, documents, deadlines, calendarEvents } = useDataContext()

  const totalTasks = tasks.length
  const completedTasks = tasks.filter((task) => task.status === 'Done').length
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
  const dueSoon = tasks.filter((task) => isDueSoon(task.dueDate)).slice(0, 5)
  const overdue = tasks.filter((task) => isOverdue(task.dueDate)).slice(0, 5)
  const upcoming = getUpcomingEvents(calendarEvents, 90).slice(0, 6)
  const recentDocs = documents.slice(0, 5)

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-300">Tasks complete</h3>
              <FontAwesomeIcon icon={faTasks} className="text-brand-500" />
            </div>
            <div className="flex items-center gap-4">
              <div
                className="relative h-20 w-20 rounded-full"
                style={{
                  background: `conic-gradient(#6366f1 ${progress * 3.6}deg, rgba(99, 102, 241, 0.15) 0deg)`
                }}
              >
                <div className="absolute inset-1 flex items-center justify-center rounded-full bg-white text-lg font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  {progress}%
                </div>
              </div>
              <div>
                <p className="text-2xl font-semibold">{completedTasks}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">of {totalTasks} total tasks</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-300">Upcoming deadlines</h3>
            <ul className="space-y-2">
              {upcoming.length === 0 && <li className="text-sm text-slate-500">No upcoming deadlines in the next 90 days.</li>}
              {upcoming.map((event) => (
                <li key={event.id} className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
                  <span>{event.title}</span>
                  <span className="font-medium">{formatDate(event.date)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-300">Due soon</h3>
            <ul className="space-y-2">
              {dueSoon.length === 0 && <li className="text-sm text-slate-500">No tasks due within 14 days.</li>}
              {dueSoon.map((task) => (
                <li key={task.id} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                  <span>{task.title}</span>
                  <span className="font-medium">{formatDate(task.dueDate)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-300">Overdue</h3>
            <ul className="space-y-2">
              {overdue.length === 0 && <li className="text-sm text-slate-500">No overdue tasks 🎉</li>}
              {overdue.map((task) => (
                <li key={task.id} className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                  <span>{task.title}</span>
                  <span className="font-medium">{formatDate(task.dueDate)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Computed deadlines</h2>
          </div>
          <div className="card-body">
            <dl className="grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-slate-500">Rule 10.5 notices</dt>
                <dd className="text-base font-semibold">{formatDate(deadlines.rule105Notice)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Certification of Notice</dt>
                <dd className="text-base font-semibold">{formatDate(deadlines.certificationOfNotice)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Inventory due</dt>
                <dd className="text-base font-semibold">{formatDate(deadlines.inventoryDue)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Inheritance tax return</dt>
                <dd className="text-base font-semibold">{formatDate(deadlines.inheritanceTaxDue)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">5% discount deadline</dt>
                <dd className="text-base font-semibold">{formatDate(deadlines.inheritanceTaxDiscount)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Creditor bar date</dt>
                <dd className="text-base font-semibold">{formatDate(deadlines.creditorBarDate)}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Recent documents</h2>
          </div>
          <div className="card-body">
            <ul className="space-y-3 text-sm">
              {recentDocs.length === 0 && <li className="text-slate-500">No documents uploaded yet.</li>}
              {recentDocs.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={doc.mimeType.includes('image') ? faImage : faFilePdf} className="text-brand-500" />
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{doc.title ?? doc.filename}</p>
                      <p className="text-xs text-slate-500">Uploaded {formatDate(doc.createdAt)}</p>
                    </div>
                  </div>
                  <Link to="/documents" className="text-xs font-semibold text-brand-600 hover:underline">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Timeline overview</h2>
          <Link to="/calendar" className="text-sm font-semibold text-brand-600 hover:underline">
            Open calendar
          </Link>
        </div>
        <div className="card-body">
          <ol className="space-y-3">
            {calendarEvents.map((event) => (
              <li key={event.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-slate-500">{event.type === 'Task' ? 'Task deadline' : 'Statutory deadline'}</p>
                </div>
                <span className="font-semibold">{formatDate(event.date)}</span>
              </li>
            ))}
            {calendarEvents.length === 0 && <li className="text-sm text-slate-500">Set estate profile to generate statutory reminders.</li>}
          </ol>
        </div>
      </section>
    </div>
  )
}
