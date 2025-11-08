import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd'
import clsx from 'clsx'
import dayjs from 'dayjs'
import { useDataContext } from '../context/DataContext'
import { StatusBadge, getStatusLabel } from '../components/StatusBadge'
import { Task, TaskCategory, TaskStatus } from '../types'
import { exportTasksToCsv, exportTasksToPdf } from '../utils/export'
import { formatDate, formatDateInput, isDueSoon, isOverdue } from '../utils/date'

const statusOrder: TaskStatus[] = ['Todo', 'InProgress', 'Blocked', 'Done']
const categoryOptions: TaskCategory[] = ['Legal', 'Tax', 'Property', 'Financial', 'Comms', 'Other']

interface TaskFormState {
  id?: string
  title: string
  description: string
  dueDate: string
  category: TaskCategory
  tags: string
  assignedTo: string
  status: TaskStatus
}

const defaultForm: TaskFormState = {
  title: '',
  description: '',
  dueDate: '',
  category: 'Legal',
  tags: '',
  assignedTo: '',
  status: 'Todo'
}

export const TasksPage = () => {
  const location = useLocation()
  const {
    tasks,
    addTask,
    updateTask,
    updateTaskStatus,
    removeTask
  } = useDataContext()
  const [form, setForm] = useState<TaskFormState>(defaultForm)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')

  useEffect(() => {
    if ((location.state as { newTask?: boolean } | undefined)?.newTask) {
      setForm(defaultForm)
      setViewMode('list')
    }
  }, [location.state])

  const categories = useMemo(() => {
    const fromTasks = new Set<TaskCategory>(tasks.map((task) => task.category))
    categoryOptions.forEach((category) => fromTasks.add(category))
    return Array.from(fromTasks)
  }, [tasks])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) return

    const payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      dueDate: form.dueDate ? dayjs(form.dueDate).toISOString() : undefined,
      category: form.category,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      assignedTo: form.assignedTo
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      status: form.status,
      relatedIds: undefined
    }

    if (form.id) {
      await updateTask(form.id, payload)
    } else {
      await addTask({ ...payload, status: payload.status })
    }
    setForm(defaultForm)
  }

  const handleEdit = (task: Task) => {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description ?? '',
      dueDate: formatDateInput(task.dueDate),
      category: task.category,
      tags: task.tags.join(', '),
      assignedTo: (task.assignedTo ?? []).join(', '),
      status: task.status
    })
  }

  const handleCancelEdit = () => setForm(defaultForm)

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  const applyBatchStatus = async (status: TaskStatus) => {
    await Promise.all(Array.from(selected).map((id) => updateTaskStatus(id, status)))
    clearSelection()
  }

  const applyBatchDueDate = async (date: string) => {
    const iso = date ? dayjs(date).toISOString() : undefined
    await Promise.all(Array.from(selected).map((id) => updateTask(id, { dueDate: iso })))
    clearSelection()
  }

  const applyBatchTags = async (tagString: string) => {
    const tags = tagString
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    if (tags.length === 0) return
    const updates = Array.from(selected).map((id) => {
      const existing = tasks.find((task) => task.id === id)
      const combined = Array.from(new Set([...(existing?.tags ?? []), ...tags]))
      return updateTask(id, { tags: combined })
    })
    await Promise.all(updates)
    clearSelection()
  }

  const filteredTasks = useMemo(
    () =>
      tasks
        .slice()
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    [tasks]
  )

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const status = result.destination.droppableId as TaskStatus
    const taskId = result.draggableId
    await updateTaskStatus(taskId, status)
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-lg font-semibold">{form.id ? 'Update task' : 'Add task'}</h2>
            <p className="text-sm text-slate-500">Capture estate workstreams, assign owners, and track deadlines.</p>
          </div>
        </div>
        <form className="card-body grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <label className="label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="input"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              className="input"
              rows={3}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="input"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as TaskCategory }))}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dueDate">
              Due date
            </label>
            <input
              id="dueDate"
              type="date"
              className="input"
              value={form.dueDate}
              onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="tags">
              Tags (comma separated)
            </label>
            <input
              id="tags"
              className="input"
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="assignedTo">
              Assigned to (comma separated)
            </label>
            <input
              id="assignedTo"
              className="input"
              value={form.assignedTo}
              onChange={(event) => setForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              className="input"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as TaskStatus }))}
            >
              {statusOrder.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <button type="submit" className="btn btn-primary">
              {form.id ? 'Save changes' : 'Add task'}
            </button>
            {form.id && (
              <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={clsx('btn', viewMode === 'list' ? 'btn-primary' : 'btn-secondary')}
            onClick={() => setViewMode('list')}
          >
            List view
          </button>
          <button
            type="button"
            className={clsx('btn', viewMode === 'board' ? 'btn-primary' : 'btn-secondary')}
            onClick={() => setViewMode('board')}
          >
            Kanban board
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => exportTasksToCsv(tasks)}>
            Export CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => exportTasksToPdf(tasks)}>
            Export PDF
          </button>
        </div>
      </section>

      {selected.size > 0 && (
        <section className="card">
          <div className="card-body flex flex-wrap items-center gap-3 text-sm">
            <p className="font-medium">Bulk actions ({selected.size} selected)</p>
            <button type="button" className="btn btn-secondary" onClick={() => applyBatchStatus('Done')}>
              Mark complete
            </button>
            <div className="flex items-center gap-2">
              <label className="label" htmlFor="bulkDueDate">
                Set due date
              </label>
              <input
                id="bulkDueDate"
                type="date"
                className="input"
                onChange={(event) => {
                  void applyBatchDueDate(event.target.value)
                  event.target.value = ''
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="label" htmlFor="bulkTags">
                Add tags
              </label>
              <input
                id="bulkTags"
                className="input"
                placeholder="legal, filings"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void applyBatchTags((event.target as HTMLInputElement).value)
                    ;(event.target as HTMLInputElement).value = ''
                  }
                }}
              />
            </div>
            <button type="button" className="btn btn-secondary" onClick={clearSelection}>
              Clear selection
            </button>
          </div>
        </section>
      )}

      {viewMode === 'list' ? (
        <section className="card">
          <div className="card-body overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Task</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Due</th>
                  <th className="px-3 py-2 text-left font-medium">Tags</th>
                  <th className="px-3 py-2 text-left font-medium">Assignees</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                        checked={selected.has(task.id)}
                        onChange={() => toggleSelected(task.id)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{task.title}</div>
                      {task.description && <p className="text-xs text-slate-500">{task.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">{task.category}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {task.dueDate ? (
                        <span
                          className={clsx('font-medium', {
                            'text-amber-600 dark:text-amber-300': isDueSoon(task.dueDate),
                            'text-rose-600 dark:text-rose-300': isOverdue(task.dueDate)
                          })}
                        >
                          {formatDate(task.dueDate)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-500">{task.tags.join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-sm text-slate-500">{(task.assignedTo ?? []).join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          type="button"
                          className="text-brand-600 hover:underline"
                          onClick={() => void updateTaskStatus(task.id, task.status === 'Done' ? 'Todo' : 'Done')}
                        >
                          {task.status === 'Done' ? 'Reopen' : 'Complete'}
                        </button>
                        <button type="button" className="text-slate-500 hover:underline" onClick={() => handleEdit(task)}>
                          Edit
                        </button>
                        <button type="button" className="text-rose-500 hover:underline" onClick={() => void removeTask(task.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statusOrder.map((status) => (
              <Droppable droppableId={status} key={status}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="card flex max-h-[32rem] flex-col overflow-hidden"
                  >
                    <div className="card-header">
                      <h3 className="text-sm font-semibold">{getStatusLabel(status)}</h3>
                      <span className="text-xs text-slate-500">{tasks.filter((task) => task.status === status).length}</span>
                    </div>
                    <div className="card-body space-y-3 overflow-y-auto">
                      {tasks
                        .filter((task) => task.status === status)
                        .map((task, index) => (
                          <Draggable draggableId={task.id} index={index} key={task.id}>
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium text-slate-800 dark:text-slate-100">{task.title}</p>
                                    {task.dueDate && (
                                      <p
                                        className={clsx('text-xs font-semibold', {
                                          'text-amber-600 dark:text-amber-300': isDueSoon(task.dueDate),
                                          'text-rose-500 dark:text-rose-300': isOverdue(task.dueDate)
                                        })}
                                      >
                                        Due {formatDate(task.dueDate)}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-brand-600 hover:underline"
                                    onClick={() => handleEdit(task)}
                                  >
                                    Edit
                                  </button>
                                </div>
                                {task.tags.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {task.tags.map((tag) => (
                                      <span
                                        key={tag}
                                        className="inline-flex items-center rounded-full bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-600 dark:bg-brand-400/10 dark:text-brand-200"
                                      >
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                  <span>{task.category}</span>
                                  <select
                                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                                    value={task.status}
                                    onChange={(event) => void updateTaskStatus(task.id, event.target.value as TaskStatus)}
                                  >
                                    {statusOrder.map((option) => (
                                      <option key={option} value={option}>
                                        {getStatusLabel(option)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  )
}
