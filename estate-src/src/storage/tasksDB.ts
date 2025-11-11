import Dexie, { Table } from 'dexie'
import type { EstateId } from '../types/estate'

export type TaskStatus = 'not-started' | 'in-progress' | 'done'
export type TaskPriority = 'low' | 'med' | 'high'

export interface TaskRecord {
  id: string
  estateId: EstateId
  title: string
  description: string
  due_date: string
  status: TaskStatus
  priority: TaskPriority
  tags: string[]
  docIds: string[]
  created_at: string
  updated_at: string
  seedVersion?: string
}

export interface DocumentRecord {
  id: string
  estateId: EstateId
  title: string
  tags: string[]
  taskId: string | null
  contentType: string
  size: number
  file: Blob | null | undefined
  fileName: string | null | undefined
  storagePath: string | null | undefined
  created_at: string
}

export interface JournalEntryRecord {
  id: string
  estateId: EstateId
  title: string
  body: string
  created_at: string
}

class EstateWorkspaceDB extends Dexie {
  tasks!: Table<TaskRecord, string>
  documents!: Table<DocumentRecord, string>
  journalEntries!: Table<JournalEntryRecord, string>

  constructor() {
    super('estate-workspace')
    this.version(1).stores({
      tasks: 'id, due_date, status, priority, created_at, updated_at, *tags, *docIds',
    })
    this.version(2).stores({
      tasks: 'id, due_date, status, priority, created_at, updated_at, *tags, *docIds',
      documents: 'id, title, contentType, size, created_at, taskId, *tags',
    })
    this.version(3).stores({
      tasks: 'id, due_date, status, priority, created_at, updated_at, *tags, *docIds',
      documents: 'id, title, contentType, size, created_at, taskId, *tags',
      journalEntries: 'id, created_at, title',
    })
    this.version(4)
      .stores({
        tasks: 'id, estateId, due_date, status, priority, created_at, updated_at, seedVersion, *tags, *docIds',
        documents: 'id, estateId, title, contentType, size, created_at, taskId, *tags',
        journalEntries: 'id, estateId, created_at, title',
      })
      .upgrade(async (transaction) => {
        await transaction.table('tasks').toCollection().modify((task: TaskRecord & { estateId?: EstateId }) => {
          if (!task.estateId) {
            task.estateId = 'mother'
          }
        })
        await transaction
          .table('documents')
          .toCollection()
          .modify((doc: DocumentRecord & { estateId?: EstateId }) => {
            if (!doc.estateId) {
              doc.estateId = 'mother'
            }
          })
        await transaction
          .table('journalEntries')
          .toCollection()
          .modify((entry: JournalEntryRecord & { estateId?: EstateId }) => {
            if (!entry.estateId) {
              entry.estateId = 'mother'
          }
        })
      })
    this.version(5)
      .stores({
        tasks: 'id, estateId, due_date, status, priority, created_at, updated_at, seedVersion, *tags, *docIds',
        documents: 'id, estateId, title, contentType, size, created_at, taskId, storagePath, *tags',
        journalEntries: 'id, estateId, created_at, title',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table('documents')
          .toCollection()
          .modify((doc: any) => {
            if (doc.fileName === undefined) {
              doc.fileName = null
            }
            if (doc.storagePath === undefined) {
              doc.storagePath = null
            }
          })
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

export type TaskInput = Omit<TaskRecord, 'id' | 'created_at' | 'updated_at' | 'docIds'> & {
  docIds?: string[]
}

export const createTask = async (task: TaskInput) => {
  const id = generateId('task')
  const record: TaskRecord = {
    ...task,
    id,
    docIds: task.docIds ?? [],
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

export type DocumentInput = {
  file: File
  title: string
  tags: string[]
  estateId: EstateId
  taskId?: string | null
  id?: string
  fileName?: string
}

export const createDocument = async ({ file, title, tags, taskId, estateId, id: providedId, fileName }: DocumentInput) => {
  const id = providedId ?? generateId('doc')
  let resolvedEstateId: EstateId = estateId

  if (taskId) {
    const task = await db.tasks.get(taskId)
    if (task) {
      resolvedEstateId = task.estateId
    }
  }

  const record: DocumentRecord = {
    id,
    estateId: resolvedEstateId,
    title,
    tags,
    taskId: null,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    file,
    fileName: fileName ?? file.name ?? `${id}.bin`,
    storagePath: null,
    created_at: nowISO(),
  }

  await db.documents.add(record)

  if (taskId) {
    await linkDocumentToTask(id, taskId)
  }

  return id
}

export const updateDocument = async (
  id: string,
  updates: Partial<Pick<DocumentRecord, 'title' | 'tags' | 'taskId'>>,
) => {
  await db.documents.update(id, updates)
}

export const deleteDocument = async (id: string) => {
  const doc = await db.documents.get(id)
  if (!doc) return

  await db.transaction('rw', db.documents, db.tasks, async () => {
    if (doc.taskId) {
      const task = await db.tasks.get(doc.taskId)
      if (task) {
        await db.tasks.update(doc.taskId, {
          docIds: task.docIds.filter((docId) => docId !== id),
          updated_at: nowISO(),
        })
      }
    }

    await db.documents.delete(id)
  })
}

export const linkDocumentToTask = async (docId: string, taskId: string) => {
  await db.transaction('rw', db.documents, db.tasks, async () => {
    const [doc, task] = await Promise.all([
      db.documents.get(docId),
      db.tasks.get(taskId),
    ])

    if (!doc || !task) {
      throw new Error('Document or task not found')
    }

    if (doc.estateId !== task.estateId) {
      await db.documents.update(docId, { estateId: task.estateId })
    }

    if (doc.taskId && doc.taskId !== taskId) {
      const previousTask = await db.tasks.get(doc.taskId)
      if (previousTask) {
        await db.tasks.update(previousTask.id, {
          docIds: previousTask.docIds.filter((id) => id !== docId),
          updated_at: nowISO(),
        })
      }
    }

    await db.documents.update(docId, { taskId })

    if (!task.docIds.includes(docId)) {
      await db.tasks.update(taskId, {
        docIds: [...task.docIds, docId],
        updated_at: nowISO(),
      })
    } else {
      await db.tasks.update(taskId, { updated_at: nowISO() })
    }
  })
}

export const unlinkDocumentFromTask = async (docId: string) => {
  await db.transaction('rw', db.documents, db.tasks, async () => {
    const doc = await db.documents.get(docId)
    if (!doc) return

    const { taskId } = doc
    await db.documents.update(docId, { taskId: null })

    if (!taskId) return

    const task = await db.tasks.get(taskId)
    if (!task) return

    await db.tasks.update(taskId, {
      docIds: task.docIds.filter((id) => id !== docId),
      updated_at: nowISO(),
    })
  })
}

export type JournalEntryInput = Pick<JournalEntryRecord, 'title' | 'body'>

export const getJournalEntries = async (estateId: EstateId) => {
  return db.journalEntries.where('estateId').equals(estateId).sortBy('created_at').then((entries) => entries.reverse())
}

export const createJournalEntry = async ({ title, body, estateId }: JournalEntryInput & { estateId: EstateId }) => {
  const record: JournalEntryRecord = {
    id: generateId('journal'),
    estateId,
    title,
    body,
    created_at: nowISO(),
  }

  await db.journalEntries.add(record)
  return record.id
}

export const updateJournalEntry = async (
  id: string,
  updates: Partial<Pick<JournalEntryRecord, 'title' | 'body'>>,
) => {
  await db.journalEntries.update(id, updates)
}

export const deleteJournalEntry = async (id: string) => {
  await db.journalEntries.delete(id)
}

const generateId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`
}
