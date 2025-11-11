import type { SupabaseClient } from '@supabase/supabase-js'
import { getClient, getSupabaseSession } from '../lib/supabaseClient'
import {
  db,
  type DocumentInput,
  type DocumentRecord,
  type JournalEntryInput,
  type JournalEntryRecord,
  type TaskInput,
  type TaskRecord,
  createDocument as createLocalDocument,
  createJournalEntry as createLocalJournalEntry,
  createTask as createLocalTask,
  deleteJournalEntry as deleteLocalJournalEntry,
  deleteTask as deleteLocalTask,
  linkDocumentToTask as linkDocumentToTaskLocal,
  unlinkDocumentFromTask as unlinkDocumentFromTaskLocal,
  updateJournalEntry as updateLocalJournalEntry,
  updateTask as updateLocalTask,
} from '../storage/tasksDB'
import {
  loadEstateProfiles,
  saveEstateProfiles,
  saveSeedGuidance,
  saveSeedTasks,
  saveSeedVersion,
} from '../storage/estatePlan'
import type { EstateId, EstateProfile, SeedGuidancePage, SeedTask } from '../types/estate'
import type { PlanV2 } from '../features/plan/planSchema'

interface SupabaseContext {
  client: SupabaseClient
  userId: string
}

const getSupabaseContext = async (): Promise<SupabaseContext | null> => {
  const client = getClient()
  if (!client) return null
  const session = await getSupabaseSession()
  if (!session?.user?.id) return null
  return { client, userId: session.user.id }
}

export const isCloudSignedIn = async () => Boolean(await getSupabaseContext())

const generateDocumentId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `doc-${Math.random().toString(36).slice(2, 11)}`
}

type SupabaseTaskRow = {
  id: string
  estate_id: EstateId
  title: string
  description: string | null
  due_date: string | null
  status: TaskRecord['status']
  priority: TaskRecord['priority']
  tags: string[] | null
  doc_ids: string[] | null
  created_at: string
  updated_at: string
  seed_version: string | null
}

type SupabaseJournalRow = {
  id: string
  estate_id: EstateId
  title: string
  body: string
  created_at: string
}

type SupabaseDocumentMetaRow = {
  id: string
  user_id: string
  estate_id: EstateId
  title: string | null
  file_name: string | null
  storage_path: string | null
  content_type: string | null
  size: number | null
  tags: string[] | null
  task_id: string | null
  created_at: string | null
  updated_at: string | null
}

type SupabaseEstateRow = {
  id: EstateId
  user_id: string
  label: string | null
  county: string | null
  decedent_name: string | null
  dod_iso: string | null
  letters_iso: string | null
  first_publication_iso: string | null
  notes: string | null
  updated_at: string | null
}

type SupabaseGuidanceRow = {
  id: string
  estate_id: EstateId
  title: string
  summary: string | null
  body: string | null
  tags: string[] | null
  notes: string[] | null
  steps: { title?: string; detail?: string }[] | null
  templates: { id: string; title?: string; body?: string }[] | null
  seed_version: string | null
  updated_at: string | null
}

const mapTaskRowToRecord = (row: SupabaseTaskRow): TaskRecord => ({
  id: row.id,
  estateId: row.estate_id,
  title: row.title,
  description: row.description ?? '',
  due_date: row.due_date ?? new Date().toISOString(),
  status: row.status,
  priority: row.priority,
  tags: row.tags ?? [],
  docIds: row.doc_ids ?? [],
  created_at: row.created_at,
  updated_at: row.updated_at,
  seedVersion: row.seed_version ?? undefined,
})

const replaceEstateTasks = async (estateId: EstateId, tasks: TaskRecord[]) => {
  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.where('estateId').equals(estateId).delete()
    if (tasks.length > 0) {
      await db.tasks.bulkAdd(tasks)
    }
  })
}

const upsertTaskCache = async (record: TaskRecord) => {
  await db.tasks.put(record)
}

const removeTaskFromCache = async (id: string) => {
  await db.tasks.delete(id)
}

const mapJournalRowToRecord = (row: SupabaseJournalRow): JournalEntryRecord => ({
  id: row.id,
  estateId: row.estate_id,
  title: row.title,
  body: row.body,
  created_at: row.created_at,
})

const replaceJournalEntries = async (estateId: EstateId, entries: JournalEntryRecord[]) => {
  await db.transaction('rw', db.journalEntries, async () => {
    await db.journalEntries.where('estateId').equals(estateId).delete()
    if (entries.length > 0) {
      await db.journalEntries.bulkAdd(entries)
    }
  })
}

const nowISO = () => new Date().toISOString()

const mapDocumentMetaRowToRecord = (row: SupabaseDocumentMetaRow): DocumentRecord => ({
  id: row.id,
  estateId: row.estate_id,
  title: row.title ?? row.file_name ?? 'Untitled document',
  tags: row.tags ?? [],
  taskId: row.task_id ?? null,
  contentType: row.content_type ?? 'application/octet-stream',
  size: row.size ?? 0,
  file: null,
  fileName: row.file_name ?? null,
  storagePath: row.storage_path ?? null,
  created_at: row.created_at ?? nowISO(),
})

const extensionFromContentType = (contentType: string | null | undefined) => {
  if (!contentType) return null
  if (contentType.includes('pdf')) return 'pdf'
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') return 'jpg'
  if (contentType === 'image/gif') return 'gif'
  if (contentType === 'image/webp') return 'webp'
  if (contentType.includes('text/plain')) return 'txt'
  return null
}

const ensureFileNameExtension = (fileName: string, contentType: string) => {
  const extension = extensionFromContentType(contentType)
  if (!extension) return fileName
  if (fileName.toLowerCase().endsWith(`.${extension}`)) {
    return fileName
  }
  return `${fileName}.${extension}`
}

const sanitizeFileName = (fileName: string) => {
  const invalidChars = /[^a-zA-Z0-9._ -]+/g
  const spaces = /\s+/g
  const hyphenRuns = /-+/g
  const trimHyphens = /^-+|-+$/g
  const normalized = fileName.normalize('NFKD').replace(invalidChars, '')
  const collapsed = normalized.replace(spaces, '-').replace(hyphenRuns, '-').replace(trimHyphens, '')
  return collapsed || 'document'
}

const buildSafeFileName = (fileName: string, contentType: string) =>
  ensureFileNameExtension(sanitizeFileName(fileName), contentType)

type UploadDocumentPayload = {
  id: string
  estateId: EstateId
  title: string
  tags: string[]
  taskId: string | null
  file: File
  fileName?: string | null
  createdAt?: string
}

const uploadDocumentToCloud = async (context: SupabaseContext, payload: UploadDocumentPayload) => {
  const { client, userId } = context
  const contentType = payload.file.type || 'application/octet-stream'
  const baseName = payload.fileName ?? payload.file.name ?? `${payload.id}.bin`
  const safeFileName = buildSafeFileName(baseName, contentType)
  const storagePath = `${userId}/${payload.estateId}/${payload.id}-${safeFileName}`

  const { error: uploadError } = await client.storage.from('documents').upload(storagePath, payload.file, {
    contentType,
    upsert: true,
  })

  if (uploadError) {
    throw uploadError
  }

  const { data: metaData, error: metaError } = await client
    .from('documents_meta')
    .upsert(
      {
        id: payload.id,
        user_id: userId,
        estate_id: payload.estateId,
        title: payload.title,
        file_name: safeFileName,
        storage_path: storagePath,
        content_type: contentType,
        size: payload.file.size,
        tags: payload.tags,
        task_id: payload.taskId,
        created_at: payload.createdAt ?? nowISO(),
        updated_at: nowISO(),
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single()

  if (metaError) {
    await client.storage.from('documents').remove([storagePath])
    throw metaError
  }

  const record = mapDocumentMetaRowToRecord(metaData as SupabaseDocumentMetaRow)

  const mergedRecord: DocumentRecord = {
    ...record,
    title: payload.title,
    tags: payload.tags,
    taskId: payload.taskId,
    contentType,
    size: payload.file.size,
    fileName: safeFileName,
    storagePath: record.storagePath ?? storagePath,
    file: null,
  }

  await db.documents.put(mergedRecord)

  return mergedRecord
}

const replaceCloudDocuments = async (estateId: EstateId, documents: DocumentRecord[]) => {
  await db.transaction('rw', db.documents, async () => {
    const existing = await db.documents.where('estateId').equals(estateId).toArray()
    const remoteIds = new Set(documents.map((doc) => doc.id))
    const toDelete = existing
      .filter((doc) => doc.storagePath && !remoteIds.has(doc.id))
      .map((doc) => doc.id)

    if (toDelete.length > 0) {
      await db.documents.bulkDelete(toDelete)
    }

    if (documents.length > 0) {
      await db.documents.bulkPut(documents)
    }
  })
}

export const syncDocumentsFromCloud = async (estateId: EstateId) => {
  const context = await getSupabaseContext()
  if (!context) return false

  const { client } = context
  const { data, error } = await client
    .from('documents_meta')
    .select('*')
    .eq('estate_id', estateId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as SupabaseDocumentMetaRow[]
  const records = rows.map(mapDocumentMetaRowToRecord)
  await replaceCloudDocuments(estateId, records)
  return true
}

const getSignedUrlForPath = async (storagePath: string, expiresIn = 60) => {
  const context = await getSupabaseContext()
  if (!context) {
    throw new Error('Supabase session not available')
  }

  const { client } = context
  const { data, error } = await client.storage.from('documents').createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  if (!data?.signedUrl) {
    throw new Error('Unable to generate signed URL')
  }
  return data.signedUrl
}

export const getDocumentSignedUrl = async (doc: DocumentRecord, expiresIn = 60) => {
  if (!doc.storagePath) {
    throw new Error('Document is not stored in Supabase')
  }
  return getSignedUrlForPath(doc.storagePath, expiresIn)
}

export const getDocumentBlob = async (doc: DocumentRecord): Promise<Blob> => {
  if (doc.storagePath) {
    const signedUrl = await getDocumentSignedUrl(doc, 60)
    const response = await fetch(signedUrl)
    if (!response.ok) {
      throw new Error('Unable to fetch document from Supabase')
    }
    return response.blob()
  }

  if (doc.file) {
    return doc.file
  }

  throw new Error('Document data is not available')
}

export const syncTasksFromCloud = async (estateId: EstateId) => {
  const context = await getSupabaseContext()
  if (!context) return false
  const { client } = context
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('estate_id', estateId)
    .order('due_date', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as SupabaseTaskRow[]
  const tasks = rows.map(mapTaskRowToRecord)
  await replaceEstateTasks(estateId, tasks)
  return true
}

const normalizeTaskInput = (task: TaskInput & { estateId: EstateId }) => ({
  estate_id: task.estateId,
  title: task.title,
  description: task.description,
  due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
  status: task.status,
  priority: task.priority,
  tags: task.tags ?? [],
  doc_ids: task.docIds ?? [],
})

export const createTask = async (task: TaskInput & { estateId: EstateId }) => {
  const context = await getSupabaseContext()
  if (!context) {
    return createLocalTask(task)
  }

  const { client } = context
  const payload = {
    ...normalizeTaskInput(task),
    created_at: nowISO(),
    updated_at: nowISO(),
  }

  const { data, error } = await client
    .from('tasks')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  const record = mapTaskRowToRecord(data as SupabaseTaskRow)
  await upsertTaskCache(record)
  return record.id
}

export const updateTask = async (
  id: string,
  updates: Partial<Omit<TaskRecord, 'id' | 'created_at' | 'updated_at'>>,
) => {
  const context = await getSupabaseContext()
  if (!context) {
    await updateLocalTask(id, updates)
    return
  }
  const { client } = context
  const payload: Record<string, unknown> = {
    updated_at: nowISO(),
  }
  if (updates.title !== undefined) payload.title = updates.title
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.due_date !== undefined) payload.due_date = updates.due_date ? new Date(updates.due_date).toISOString() : null
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.priority !== undefined) payload.priority = updates.priority
  if (updates.tags !== undefined) payload.tags = updates.tags
  if (updates.docIds !== undefined) payload.doc_ids = updates.docIds
  if (updates.estateId !== undefined) payload.estate_id = updates.estateId
  if ('seedVersion' in updates) payload.seed_version = updates.seedVersion ?? null

  const { data, error } = await client
    .from('tasks')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  const record = mapTaskRowToRecord(data as SupabaseTaskRow)
  await upsertTaskCache(record)
}

export const deleteTask = async (id: string) => {
  const context = await getSupabaseContext()
  if (!context) {
    await deleteLocalTask(id)
    return
  }
  const { client } = context
  const { error } = await client.from('tasks').delete().eq('id', id)
  if (error) throw error
  await removeTaskFromCache(id)
}

const resolveTaskDocIds = async (taskId: string) => {
  const task = await db.tasks.get(taskId)
  return task?.docIds ?? []
}

export const linkDocumentToTask = async (docId: string, taskId: string) => {
  const context = await getSupabaseContext()
  if (!context) {
    await linkDocumentToTaskLocal(docId, taskId)
    return
  }

  const { client } = context
  const currentDocIds = await resolveTaskDocIds(taskId)
  const docIds = Array.from(new Set([...currentDocIds, docId]))

  await updateTask(taskId, { docIds })

  await client
    .from('documents_meta')
    .update({ task_id: taskId, updated_at: nowISO() })
    .eq('id', docId)

  const doc = await db.documents.get(docId)
  if (doc) {
    await db.documents.update(docId, { taskId })
  }
}

export const unlinkDocumentFromTask = async (docId: string) => {
  const context = await getSupabaseContext()
  if (!context) {
    await unlinkDocumentFromTaskLocal(docId)
    return
  }

  const { client } = context
  const doc = (await db.documents.get(docId)) as DocumentRecord | undefined
  if (doc?.taskId) {
    const currentDocIds = await resolveTaskDocIds(doc.taskId)
    const docIds = currentDocIds.filter((id) => id !== docId)
    await updateTask(doc.taskId, { docIds })
  }
  await db.documents.update(docId, { taskId: null })

  await client
    .from('documents_meta')
    .update({ task_id: null, updated_at: nowISO() })
    .eq('id', docId)
}

export const createDocument = async ({ file, title, tags, taskId, estateId, id, fileName }: DocumentInput) => {
  const context = await getSupabaseContext()
  if (!context) {
    return createLocalDocument({ file, title, tags, taskId, estateId, id, fileName })
  }

  const documentId = id ?? generateDocumentId()

  let resolvedEstateId: EstateId = estateId
  if (taskId) {
    const relatedTask = await db.tasks.get(taskId)
    if (relatedTask) {
      resolvedEstateId = relatedTask.estateId
    }
  }

  const resolvedTaskId = taskId ?? null

  await uploadDocumentToCloud(context, {
    id: documentId,
    estateId: resolvedEstateId,
    title,
    tags,
    taskId: resolvedTaskId,
    file,
    fileName: fileName ?? file.name ?? `${documentId}.bin`,
    createdAt: nowISO(),
  })

  if (resolvedTaskId) {
    await linkDocumentToTask(documentId, resolvedTaskId)
  } else {
    await db.documents.update(documentId, { taskId: null })
  }

  return documentId
}

export const migrateLocalDocumentsToCloud = async () => {
  const context = await getSupabaseContext()
  if (!context) {
    throw new Error('Supabase session not available')
  }

  const documents = await db.documents.toArray()
  const estatesToRefresh = new Set<EstateId>()

  for (const doc of documents) {
    if (!doc.file || doc.storagePath) continue

    const contentType = doc.contentType || 'application/octet-stream'
    const baseName = doc.fileName ?? doc.title ?? 'document'
    const safeFileName = buildSafeFileName(baseName, contentType)
    const fileForUpload = new File([doc.file], safeFileName, { type: contentType })

    await uploadDocumentToCloud(context, {
      id: doc.id,
      estateId: doc.estateId,
      title: doc.title,
      tags: doc.tags,
      taskId: doc.taskId ?? null,
      file: fileForUpload,
      fileName: safeFileName,
      createdAt: doc.created_at,
    })

    estatesToRefresh.add(doc.estateId)

    if (doc.taskId) {
      await linkDocumentToTask(doc.id, doc.taskId)
    }
  }

  await Promise.all(
    Array.from(estatesToRefresh).map((estateId) =>
      syncDocumentsFromCloud(estateId).catch((error) => {
        console.error(error)
      }),
    ),
  )
}

export const syncJournalFromCloud = async (estateId: EstateId) => {
  const context = await getSupabaseContext()
  if (!context) return false
  const { client } = context
  const { data, error } = await client
    .from('journal')
    .select('*')
    .eq('estate_id', estateId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as SupabaseJournalRow[]
  const entries = rows.map(mapJournalRowToRecord)
  await replaceJournalEntries(estateId, entries)
  return true
}

export const createJournalEntry = async ({ title, body, estateId }: JournalEntryInput & { estateId: EstateId }) => {
  const context = await getSupabaseContext()
  if (!context) {
    return createLocalJournalEntry({ title, body, estateId })
  }

  const { client } = context
  const payload = {
    estate_id: estateId,
    title,
    body,
    created_at: nowISO(),
  }

  const { data, error } = await client
    .from('journal')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  const record = mapJournalRowToRecord(data as SupabaseJournalRow)
  await db.journalEntries.put(record)
  return record.id
}

export const updateJournalEntry = async (
  id: string,
  updates: Partial<Pick<JournalEntryRecord, 'title' | 'body'>>,
) => {
  const context = await getSupabaseContext()
  if (!context) {
    await updateLocalJournalEntry(id, updates)
    return
  }
  const { client } = context
  const payload: Record<string, unknown> = {}
  if (updates.title !== undefined) payload.title = updates.title
  if (updates.body !== undefined) payload.body = updates.body
  const { data, error } = await client
    .from('journal')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  const record = mapJournalRowToRecord(data as SupabaseJournalRow)
  await db.journalEntries.put(record)
}

export const deleteJournalEntry = async (id: string) => {
  const context = await getSupabaseContext()
  if (!context) {
    await deleteLocalJournalEntry(id)
    return
  }
  const { client } = context
  const { error } = await client.from('journal').delete().eq('id', id)
  if (error) throw error
  await db.journalEntries.delete(id)
}

const mapEstateRowToProfile = (
  row: SupabaseEstateRow,
  fallback: Record<EstateId, EstateProfile>,
): EstateProfile | null => {
  if (!row.id) return null
  const estateId = row.id as EstateId
  if (!(estateId in fallback)) return null
  const profile = fallback[estateId]
  return {
    ...profile,
    label: row.label ?? profile.label,
    county: row.county ?? profile.county,
    decedentName: row.decedent_name ?? profile.decedentName,
    dodISO: row.dod_iso ?? profile.dodISO,
    lettersISO: row.letters_iso ?? undefined,
    firstPublicationISO: row.first_publication_iso ?? undefined,
    notes: row.notes ?? undefined,
  }
}

export const syncEstateProfilesFromCloud = async () => {
  const context = await getSupabaseContext()
  if (!context) return false
  const { client } = context
  const fallback = loadEstateProfiles()
  const { data, error } = await client.from('estates').select('*')
  if (error) throw error
  const next = { ...fallback }
  const rows = (data ?? []) as SupabaseEstateRow[]
  for (const row of rows) {
    const profile = mapEstateRowToProfile(row, fallback)
    if (profile) {
      const estateId = row.id as EstateId
      next[estateId] = profile
    }
  }
  saveEstateProfiles(next)
  return true
}

export const updateEstateProfile = async (profile: EstateProfile) => {
  const context = await getSupabaseContext()
  if (!context) {
    const current = loadEstateProfiles()
    saveEstateProfiles({ ...current, [profile.id]: profile })
    return
  }

  const { client, userId } = context
  const payload = {
    id: profile.id,
    user_id: userId,
    label: profile.label,
    county: profile.county,
    decedent_name: profile.decedentName,
    dod_iso: profile.dodISO,
    letters_iso: profile.lettersISO ?? null,
    first_publication_iso: profile.firstPublicationISO ?? null,
    notes: profile.notes ?? null,
    updated_at: nowISO(),
  }

  const { error } = await client.from('estates').upsert(payload)
  if (error) throw error

  const current = loadEstateProfiles()
  saveEstateProfiles({ ...current, [profile.id]: profile })
}

const mapGuidanceRowToSeed = (row: SupabaseGuidanceRow): SeedGuidancePage => ({
  id: row.id,
  title: row.title,
  summary: row.summary ?? undefined,
  body: row.body ?? undefined,
  tags: row.tags ?? undefined,
  steps: row.steps ?? undefined,
  notes: row.notes ?? undefined,
  templates: row.templates ?? undefined,
}) as SeedGuidancePage

export const syncGuidanceFromCloud = async (estateId: EstateId) => {
  const context = await getSupabaseContext()
  if (!context) return false
  const { client } = context
  const { data, error } = await client
    .from('guidance')
    .select('*')
    .eq('estate_id', estateId)
    .order('updated_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as SupabaseGuidanceRow[]
  const entries = rows.map(mapGuidanceRowToSeed)
  saveSeedGuidance(estateId, entries)
  return true
}

export const syncSeedTasksFromCloud = async (estateId: EstateId) => {
  const context = await getSupabaseContext()
  if (!context) return false
  const { client } = context
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .eq('estate_id', estateId)
  if (error) throw error
  const rows = (data ?? []) as SupabaseTaskRow[]
  const seeded: SeedTask[] = rows
    .filter((row) => row.seed_version)
    .map((row) => ({
      title: row.title,
      description: row.description ?? '',
      tags: row.tags ?? [],
      dueISO: row.due_date ?? undefined,
      status: row.status,
      priority: row.priority,
    }))
  saveSeedTasks(estateId, seeded)
  return true
}

export const importPlanToCloud = async (plan: PlanV2) => {
  const context = await getSupabaseContext()
  if (!context) return false
  const { client, userId } = context

  const now = nowISO()

  const estateRows = plan.profiles.map((profile) => ({
    id: profile.id,
    user_id: userId,
    label: profile.label,
    county: profile.county,
    decedent_name: profile.decedentName,
    dod_iso: profile.dodISO,
    letters_iso: profile.lettersISO ?? null,
    first_publication_iso: profile.firstPublicationISO ?? null,
    notes: profile.notes ?? null,
    updated_at: now,
  }))

  if (estateRows.length > 0) {
    const { error } = await client.from('estates').upsert(estateRows)
    if (error) throw error
  }

  const guidanceRows = plan.guidance.map((entry) => {
    const details = entry as Record<string, unknown>
    const rawId = typeof details.id === 'string' ? (details.id as string).trim() : ''
    const entryId = rawId || `${plan.seedVersion}:${entry.estateId}:${entry.title}`
    const summary = typeof details.summary === 'string' ? (details.summary as string) : null
    const body = typeof details.body === 'string' ? (details.body as string) : null
    const tags = Array.isArray(details.tags) ? (details.tags as string[]) : null
    const notes = Array.isArray(details.notes) ? (details.notes as string[]) : null
    const steps = Array.isArray(details.steps) ? (details.steps as { title?: string; detail?: string }[]) : null
    const templates = Array.isArray(details.templates)
      ? (details.templates as { id: string; title?: string; body?: string }[])
      : null

    return {
      id: entryId,
      estate_id: entry.estateId,
      title: entry.title,
      summary,
      body,
      tags,
      notes,
      steps,
      templates,
      seed_version: plan.seedVersion,
      updated_at: now,
    }
  })

  if (guidanceRows.length > 0) {
    const { error } = await client.from('guidance').upsert(guidanceRows, { onConflict: 'id' })
    if (error) throw error
  }

  const taskRows = plan.seedTasks.map((task) => ({
    estate_id: task.estateId,
    title: task.title,
    description: task.description ?? '',
    due_date: task.dueISO ?? null,
    status: task.status ?? 'not-started',
    priority: task.priority ?? 'med',
    tags: task.tags ?? [],
    doc_ids: [],
    seed_version: plan.seedVersion,
    seed_key: `${plan.seedVersion}:${task.estateId}:${task.title}`,
    user_id: userId,
    created_at: now,
    updated_at: now,
  }))

  if (taskRows.length > 0) {
    const { error } = await client.from('tasks').upsert(taskRows, { onConflict: 'seed_key' })
    if (error) throw error
  }

  saveSeedVersion(plan.seedVersion)
  await syncEstateProfilesFromCloud()
  for (const profile of plan.profiles) {
    const estateId = profile.id as EstateId
    await Promise.all([
      syncGuidanceFromCloud(estateId),
      syncSeedTasksFromCloud(estateId),
      syncTasksFromCloud(estateId),
    ])
  }

  return true
}
