import Dexie, { Table } from 'dexie'

export type TaskStatus = 'not-started' | 'in-progress' | 'done'
export type TaskPriority = 'low' | 'med' | 'high'

export interface TaskRecord {
  id: string
  title: string
  description: string
  due_date: string
  status: TaskStatus
  priority: TaskPriority
  tags: string[]
  docIds: string[]
  created_at: string
  updated_at: string
}

class EstateWorkspaceDB extends Dexie {
  tasks!: Table<TaskRecord, string>

  constructor() {
    super('estate-workspace')
    this.version(1).stores({
      tasks: 'id, due_date, status, priority, created_at, updated_at, *tags, *docIds',
    })
  }
}

export const db = new EstateWorkspaceDB()

export const seedTasksIfEmpty = async () => {
  const count = await db.tasks.count()
  if (count === 0) {
    // Intentionally empty: tasks will be generated from the estate setup flow.
  }
}

const nowISO = () => new Date().toISOString()

const normalizeISODate = (value: string) => new Date(value).toISOString()

export type TaskInput = Omit<TaskRecord, 'id' | 'created_at' | 'updated_at'>

export const createTask = async (task: TaskInput) => {
  const id = generateId()
  const record: TaskRecord = {
    ...task,
    id,
    due_date: normalizeISODate(task.due_date),
    created_at: nowISO(),
    updated_at: nowISO(),
  }
  await db.tasks.add(record)
  return id
}

export const updateTask = async (
  id: string,
  updates: Partial<Omit<TaskRecord, 'id' | 'created_at' | 'updated_at'>>,
) => {
  const payload: Partial<TaskRecord> = {
    ...updates,
    updated_at: nowISO(),
  }

  if (updates.due_date) {
    payload.due_date = normalizeISODate(updates.due_date)
  }

  await db.tasks.update(id, payload)
}

export const deleteTask = async (id: string) => {
  await db.tasks.delete(id)
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `task-${Math.random().toString(36).slice(2, 11)}`
}
