import { FormEvent, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { FaDownload, FaFilePdf, FaPlus } from 'react-icons/fa'
import { StatusBadge } from '../components/StatusBadge'
import { Tag } from '../components/Tag'
import { useDataContext } from '../contexts/DataContext'
import { Task, TaskStatus } from '../types'
import { exportTasksToCsv, exportTasksToPdf } from '../utils/exporters'
import { formatDate, isDueSoon, isOverdue } from '../utils/dates'

const statuses: TaskStatus[] = ['todo', 'inProgress', 'completed']
const autoScheduleOptions = [
  { value: '', label: 'Manual due date' },
  { value: 'heirNotice', label: 'Rule 10.5 heir notice (3 months from letters)' },
  { value: 'inventoryDue', label: 'Inventory filing (9 months from death)' },
  { value: 'inheritanceTax', label: 'Inheritance tax return (9 months from death)' },
  { value: 'inheritanceTaxDiscount', label: 'Inheritance tax discount (3 months from death)' },
  { value: 'creditorBar', label: 'Creditor claim bar date (1 year from advertisement)' }
]

interface TaskFormState {
  id?: string
  title: string
  description: string
  dueDate: string
  category: string
  tags: string
  status: TaskStatus
  autoSchedule?: string
}

const emptyForm: TaskFormState = {
  title: '',
  description: '',
  dueDate: '',
  category: '',
  tags: '',
  status: 'todo',
  autoSchedule: ''
}

export const TasksPage = () => {
  const {
    data: { tasks },
    addTask,
    updateTask,
    removeTask,
    changeTaskStatus
  } = useDataContext()

  const [form, setForm] = useState<TaskFormState>(emptyForm)
  const [filter, setFilter] = useState<{ status: 'all' | TaskStatus; category: string }>({ status: 'all', category: '' })

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus = filter.status === 'all' || task.status === filter.status
      const matchesCategory = !filter.category || task.category === filter.category
      return matchesStatus && matchesCategory
    })
  }, [tasks, filter])

  const categories = Array.from(new Set(tasks.map((task) => task.category).filter(Boolean))) as string[]

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return

    const payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      title: form.title,
      description: form.description.trim() || undefined,
      dueDate: form.autoSchedule ? undefined : form.dueDate || undefined,
      category: form.category || undefined,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      status: form.status,
      assignedTo: undefined,
      autoSchedule: (form.autoSchedule || undefined) as Task['autoSchedule']
    }

    if (form.id) {
      updateTask(form.id, { ...payload, autoSchedule: payload.autoSchedule })
    } else {
      addTask(payload)
    }
    setForm(emptyForm)
  }

  const handleEdit = (task: Task) => {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description ?? '',
      dueDate: task.dueDate ? dayjs(task.dueDate).format('YYYY-MM-DD') : '',
      category: task.category ?? '',
      tags: task.tags.join(', '),
      status: task.status,
      autoSchedule: task.autoSchedule ?? ''
    })
  }

  const handleCancel = () => setForm(emptyForm)

  return (
    <div className="page tasks">
      <section className="card">
        <div className="section-header">
          <h2>{form.id ? 'Update Task' : 'Add Task'}</h2>
        </div>
        <form className="form grid" onSubmit={handleSubmit}>
          <label>
            <span>Title</span>
            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} required />
          </label>
          <label>
            <span>Description</span>
            <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} />
          </label>
          <label>
            <span>Due date</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              disabled={!!form.autoSchedule}
            />
          </label>
          <label>
            <span>Auto schedule</span>
            <select value={form.autoSchedule} onChange={(event) => setForm((prev) => ({ ...prev, autoSchedule: event.target.value }))}>
              {autoScheduleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Category</span>
            <input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
          </label>
          <label>
            <span>Tags (comma separated)</span>
            <input value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} />
          </label>
          <label>
            <span>Status</span>
            <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as TaskStatus }))}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              <FaPlus /> {form.id ? 'Save changes' : 'Add task'}
            </button>
            {form.id && (
              <button type="button" className="btn" onClick={handleCancel}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Task Board</h2>
          <div className="actions">
            <div className="filters">
              <select value={filter.status} onChange={(event) => setFilter((prev) => ({ ...prev, status: event.target.value as TaskStatus | 'all' }))}>
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
              <select value={filter.category} onChange={(event) => setFilter((prev) => ({ ...prev, category: event.target.value }))}>
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="actions">
              <button className="btn" type="button" onClick={() => exportTasksToCsv(tasks)}>
                <FaDownload /> Export CSV
              </button>
              <button className="btn" type="button" onClick={() => exportTasksToPdf(tasks)}>
                <FaFilePdf /> Export PDF
              </button>
            </div>
          </div>
        </div>
        <div className="kanban">
          {statuses.map((status) => (
            <div key={status} className="kanban-column">
              <h3>{statusLabel(status)}</h3>
              <ul>
                {filteredTasks
                  .filter((task) => task.status === status)
                  .map((task) => (
                    <li key={task.id} className={taskClasses(task)}>
                      <div className="kanban-card">
                        <header>
                          <h4>{task.title}</h4>
                          <StatusBadge status={task.status} />
                        </header>
                        {task.description && <p>{task.description}</p>}
                        <div className="meta">
                          {task.category && <span className="meta-item">{task.category}</span>}
                          {task.tags.map((tag) => (
                            <Tag key={tag} label={tag} />
                          ))}
                        </div>
                        <div className="due">
                          {task.dueDate ? (
                            <span>Due {formatDate(task.dueDate)}</span>
                          ) : task.autoSchedule ? (
                            <span className="meta-item">Auto-scheduled</span>
                          ) : (
                            <span className="meta-item">No due date</span>
                          )}
                        </div>
                        <div className="kanban-actions">
                          <select value={task.status} onChange={(event) => changeTaskStatus(task.id, event.target.value as TaskStatus)}>
                            {statuses.map((value) => (
                              <option key={value} value={value}>
                                {statusLabel(value)}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="btn link" onClick={() => handleEdit(task)}>
                            Edit
                          </button>
                          <button type="button" className="btn link danger" onClick={() => removeTask(task.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const statusLabel = (status: TaskStatus) => {
  switch (status) {
    case 'todo':
      return 'To Do'
    case 'inProgress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    default:
      return status
  }
}

const taskClasses = (task: Task) => {
  if (task.status === 'completed') return 'completed'
  if (isOverdue(task.dueDate)) return 'overdue'
  if (isDueSoon(task.dueDate)) return 'due-soon'
  return ''
}
