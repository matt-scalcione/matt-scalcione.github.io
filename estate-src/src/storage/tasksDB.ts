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

const seedData: TaskRecord[] = [
  {
    id: 'seed-plan-review',
    title: 'Review estate plan documents',
    description:
      'Re-read existing estate plan, confirm executor assignments, and outline any updates needed before the annual review.',
    due_date: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
    status: 'in-progress',
    priority: 'high',
    tags: ['planning', 'legal'],
    docIds: ['will-v2', 'executor-letter'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'seed-inventory',
    title: 'Update household inventory spreadsheet',
    description:
      'Audit home assets and photos, add new acquisitions, and update approximate replacement values in the shared spreadsheet.',
    due_date: new Date(new Date().setDate(new Date().getDate() + 12)).toISOString(),
    status: 'not-started',
    priority: 'med',
    tags: ['operations'],
    docIds: ['inventory-2024'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'seed-family-meeting',
    title: 'Schedule quarterly family planning meeting',
    description:
      'Coordinate with beneficiaries for next meeting, confirm agenda topics, and circulate prep materials.',
    due_date: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    status: 'in-progress',
    priority: 'med',
    tags: ['family', 'communication'],
    docIds: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const seedTasksIfEmpty = async () => {
  const count = await db.tasks.count()
  if (count === 0) {
    await db.tasks.bulkAdd(seedData)
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
