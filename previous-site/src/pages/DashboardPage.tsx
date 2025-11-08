import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import { SummaryCard } from '../components/SummaryCard'
import { StatusBadge } from '../components/StatusBadge'
import { useDataContext } from '../contexts/useDataContext'
import { calculateDeadlines, formatDate, isDueSoon } from '../utils/dates'
import { AutoScheduleKey } from '../types'
import { getTaskProgress, sortTasksByDueDate } from '../utils/taskHelpers'

export const DashboardPage = () => {
  const {
    data: { tasks, documents, assets, expenses, beneficiaries, estateInfo, manualEvents }
  } = useDataContext()

  const progress = getTaskProgress(tasks)
  const overdueTasks = tasks.filter((task) => task.dueDate && dayjs(task.dueDate).isBefore(dayjs(), 'day') && task.status !== 'completed')
  const upcomingTasks = sortTasksByDueDate(
    tasks.filter((task) => task.status !== 'completed' && task.dueDate && !dayjs(task.dueDate).isBefore(dayjs(), 'day'))
  ).slice(0, 5)
  const dueSoonCount = tasks.filter((task) => isDueSoon(task.dueDate) && task.status !== 'completed').length

  const totalEstateValue = assets.reduce((sum, asset) => sum + (asset.value ?? 0), 0)
  const unreimbursed = expenses
    .filter((expense) => !expense.paidFromEstate && !expense.reimbursed)
    .reduce((sum, expense) => sum + expense.amount, 0)

  const deadlines = calculateDeadlines(estateInfo)
  const deadlineEntries = (Object.entries(deadlines) as Array<[
    AutoScheduleKey,
    string | undefined
  ]>).flatMap(([key, date]) => {
    if (!date) {
      return []
    }
    return [
      {
        key,
        date,
        label: deadlineLabels[key]
      }
    ]
  })

  const upcomingEvents = [...deadlineEntries, ...manualEvents.map((event) => ({ key: event.id, date: event.date, label: event.title }))]
    .filter((entry) => dayjs(entry.date).isAfter(dayjs().subtract(1, 'day')))
    .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
    .slice(0, 5)

  return (
    <div className="page dashboard">
      <section className="summary-grid">
        <SummaryCard
          title="Task Progress"
          value={<span>{progress.completed} / {progress.total}</span>}
          description={`Overall completion ${progress.percentage}%`}
          accent="green"
        />
        <SummaryCard
          title="Upcoming Deadlines"
          value={<span>{dueSoonCount}</span>}
          description="Tasks due in the next 14 days"
          accent="orange"
        />
        <SummaryCard
          title="Documents"
          value={<span>{documents.length}</span>}
          description="Filed and reference materials"
          accent="purple"
        />
        <SummaryCard
          title="Estate Assets"
          value={<span>${totalEstateValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
          description={`${assets.length} items tracked`}
          accent="blue"
        />
        <SummaryCard
          title="Unreimbursed Advances"
          value={<span>${unreimbursed.toFixed(2)}</span>}
          description="Expenses to reimburse executor"
          accent="red"
        />
        <SummaryCard
          title="Beneficiaries"
          value={<span>{beneficiaries.length}</span>}
          description="Contacts and distribution tracking"
          accent="green"
        />
      </section>

      <div className="grid two-column">
        <section className="card">
          <div className="section-header">
            <h2>Upcoming Tasks</h2>
            <Link to="/tasks" className="text-link">
              View all tasks
            </Link>
          </div>
          {upcomingTasks.length === 0 ? (
            <p className="empty">No upcoming tasks scheduled. Add due dates to keep deadlines visible.</p>
          ) : (
            <ul className="list">
              {upcomingTasks.map((task) => (
                <li key={task.id}>
                  <div>
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                    <div className="meta">
                      <StatusBadge status={task.status} />
                      {task.category && <span className="meta-item">{task.category}</span>}
                    </div>
                  </div>
                  <span className="meta-date">Due {formatDate(task.dueDate, 'Date TBD')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="section-header">
            <h2>Key Deadlines & Events</h2>
            <Link to="/calendar" className="text-link">
              Open calendar
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="empty">Add dates in the calendar or estate settings to populate reminders.</p>
          ) : (
            <ul className="list">
              {upcomingEvents.map((event) => (
                <li key={event.key}>
                  <div>
                    <h3>{event.label}</h3>
                  </div>
                  <span className="meta-date">{formatDate(event.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="section-header">
          <h2>Overdue</h2>
        </div>
        {overdueTasks.length === 0 ? (
          <p className="empty">No overdue work. Great job staying on schedule.</p>
        ) : (
          <ul className="list">
            {overdueTasks.map((task) => (
              <li key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  {task.description && <p>{task.description}</p>}
                </div>
                <span className="meta-date overdue">Was due {formatDate(task.dueDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const deadlineLabels: Record<AutoScheduleKey, string> = {
  heirNotice: 'Rule 10.5 heir notices due',
  inventoryDue: 'Inventory filing deadline',
  inheritanceTax: 'Inheritance tax return due',
  inheritanceTaxDiscount: 'Early inheritance tax discount deadline',
  creditorBar: 'Creditor claim period ends'
}
