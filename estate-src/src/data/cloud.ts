import type { SupabaseClient } from '@supabase/supabase-js'
import { getClient, getUserId } from '../lib/supabaseClient'
import { SAFE_MODE } from '../lib/safeMode'
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
  ESTATE_IDS,
  loadEstateProfiles,
  loadSeedGuidance,
  saveEstateProfiles,
  saveSeedGuidance,
  saveSeedTasks,
  saveSeedVersion,
} from '../storage/estatePlan'
import type {
  EstateId,
  EstateProfile as LocalEstateProfile,
  SeedGuidancePage,
  SeedTask,
} from '../types/estate'
import type { PlanV2 } from '../features/plan/planSchema'
import { getWorkspaceSyncTimestamp, setWorkspaceSyncTimestamp } from '../storage/syncState'

interface SupabaseContext {
  client: SupabaseClient
  userId: string
}

const getSupabaseContext = async (): Promise<SupabaseContext | null> => {
  if (SAFE_MODE) return null

  const client = getClient()
  if (!client) {
    return null
  }

  const userId = await getUserId(client)
  if (!userId) {
    return null
  }

  return { client, userId }
}

export const isCloudSignedIn = async () => Boolean(await getSupabaseContext())

const toPlanDate = (value?: string | null) => (value ? String(value).slice(0, 10) : null)

type InsertOrUpdateOptions = {
  client?: SupabaseClient | null
  userId?: string | null
  select?: string
}

type SupabaseMatch = Record<string, unknown>

type SeedTaskInput = {
  title: string
  description?: string | null
  dueISO?: string | null
  due_date?: string | null
  status?: unknown
  priority?: unknown
  tags?: unknown
}

type TaskLike =
  Partial<
    Pick<
      TaskRecord,
      'id' | 'title' | 'description' | 'due_date' | 'status' | 'priority' | 'tags' | 'docIds' | 'seedVersion'
    >
  > & {
    dueISO?: string | null
    dueDate?: string | null
    doc_ids?: unknown
  }

async function insertOrUpdate<T extends Record<string, unknown> = { id: string }>(
  table: string,
  match: SupabaseMatch,
  row: T,
  patch?: Partial<T>,
  options?: InsertOrUpdateOptions,
): Promise<{ status: 'inserted' | 'updated'; data: T[] }> {
  const client = options?.client ?? getClient()
  const resolvedUserId =
    options?.userId !== undefined ? options.userId : client ? await getUserId(client) : await getUserId()

  if (!client || !resolvedUserId) {
    throw new Error('Not signed in or cloud disabled')
  }

  const select = options?.select ?? 'id'

  const update = await client.from(table).update((patch ?? row) as Partial<T>).match(match).select(select)
  if (update.error && update.error.code && update.error.code !== 'PGRST116') throw update.error
  if (update.data && update.data.length > 0) {
    const updatedRows = ((update.data ?? []) as unknown) as T[]
    return { status: 'updated', data: updatedRows }
  }

  const insert = await client.from(table).insert(row).select(select)
  if (insert.error) throw insert.error
  const insertedRows = ((insert.data ?? []) as unknown) as T[]
  return { status: 'inserted', data: insertedRows }
}

export type EstateProfile = {
  id: string
  label: string
  county?: string
  notes?: string
  decedentName?: string
  decedent_name?: string
  dodISO?: string | null
  dod?: string | null
  lettersISO?: string | null
  letters?: string | null
  firstPublicationISO?: string | null
  first_publication?: string | null
}

function profileToRow(profile: EstateProfile, userId: string) {
  return {
    user_id: userId,
    id: profile.id,
    label: profile.label,
    county: profile.county ?? null,
    decedent_name: (profile.decedentName ?? profile.decedent_name ?? '').trim(),
    dod: toPlanDate(profile.dodISO ?? profile.dod ?? null),
    letters: toPlanDate(profile.lettersISO ?? profile.letters ?? null),
    first_publication: toPlanDate(profile.firstPublicationISO ?? profile.first_publication ?? null),
    notes: profile.notes ?? null,
    updated_at: new Date().toISOString(),
  }
}

export async function saveEstate(profile: EstateProfile, options?: InsertOrUpdateOptions) {
  const client = options?.client ?? getClient()
  const uid =
    options?.userId !== undefined ? options.userId : client ? await getUserId(client) : await getUserId()

  if (!client || !uid) {
    throw new Error('Not signed in or cloud disabled')
  }

  const row = profileToRow(profile, uid)
  await insertOrUpdate('estates', { user_id: uid, id: row.id }, row, row, { client, userId: uid })
}

export async function saveSeedTask(
  task: SeedTaskInput,
  estateId: string,
  seedKey: string,
  seedVersion: string,
  options?: InsertOrUpdateOptions,
) {
  const client = options?.client ?? getClient()
  const uid =
    options?.userId !== undefined ? options.userId : client ? await getUserId(client) : await getUserId()

  if (!client || !uid) {
    throw new Error('Not signed in or cloud disabled')
  }

  const row: Record<string, unknown> = {
    user_id: uid,
    estate_id: estateId,
    title: task.title,
    description: task.description ?? '',
    due_date: toPlanDate(task.dueISO ?? task.due_date ?? null),
    status: normStatus(task.status),
    priority: normPriority(task.priority),
    tags: sanitizeTags(task.tags),
    doc_ids: [],
    seed_version: seedVersion,
    seed_key: seedKey,
    updated_at: new Date().toISOString(),
  }

  let match: Record<string, string> = { user_id: uid, estate_id: estateId, seed_key: seedKey }
  const test = await client
    .from('tasks')
    .select('id,seed_key')
    .eq('user_id', uid)
    .eq('estate_id', estateId)
    .limit(1)

  if (test.error && test.error.code === '42703') {
    match = { user_id: uid, estate_id: estateId, title: task.title }
  }

  await insertOrUpdate('tasks', match, row, row, { client, userId: uid })
}

const normLinks = (arr: unknown) => {
  if (!Array.isArray(arr)) return [] as { label: string; url: string }[]
  return arr
    .map((link) => {
      if (typeof link === 'string') {
        const trimmed = link.trim()
        return { label: trimmed, url: trimmed }
      }

      const record = link as Record<string, unknown>
      const label = typeof record.label === 'string' ? record.label : typeof record.url === 'string' ? record.url : 'Link'
      const url = typeof record.url === 'string' ? record.url : ''

      return {
        label: String(label ?? 'Link').trim(),
        url: String(url ?? '').trim(),
      }
    })
    .filter((link) => link.url.length > 0)
}

export async function replaceGuidance(
  estateId: string,
  items: Array<{ title: string; body: string; links?: unknown[] }>,
  options?: InsertOrUpdateOptions,
) {
  const client = options?.client ?? getClient()
  const uid =
    options?.userId !== undefined ? options.userId : client ? await getUserId(client) : await getUserId()

  if (!client || !uid) {
    throw new Error('Not signed in or cloud disabled')
  }

  const del = await client.from('guidance').delete().eq('user_id', uid).eq('estate_id', estateId)
  if (del.error) throw del.error

  if (items.length === 0) {
    return
  }

  const rows = items.map((item) => ({
    user_id: uid,
    estate_id: estateId,
    title: item.title,
    body: item.body,
    links: normLinks(item.links ?? []),
  }))

  const ins = await client.from('guidance').insert(rows)
  if (ins.error) throw ins.error
}

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
  dod: string | null
  letters: string | null
  first_publication: string | null
  notes: string | null
  updated_at: string | null
}

type SupabaseGuidanceRow = {
  id: string
  estate_id: EstateId
  title: string
  body: string | null
  links: { label: string; url: string }[] | null
  created_at: string | null
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

const toSupabaseTaskPayload = (task: TaskRecord, userId: string) => ({
  id: task.id,
  user_id: userId,
  estate_id: task.estateId,
  title: task.title,
  description: task.description,
  due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
  status: task.status,
  priority: task.priority,
  tags: task.tags ?? [],
  doc_ids: task.docIds ?? [],
  created_at: task.created_at,
  updated_at: task.updated_at,
  seed_version: task.seedVersion ?? null,
})

const isoToMillis = (value: string | null | undefined) => {
  if (!value) return 0
  const date = new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

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

const toSupabaseJournalPayload = (entry: JournalEntryRecord, userId: string) => ({
  id: entry.id,
  user_id: userId,
  estate_id: entry.estateId,
  title: entry.title,
  body: entry.body,
  created_at: entry.created_at,
  updated_at: entry.created_at,
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

const DEFAULT_ESTATE_ID: EstateId = ESTATE_IDS[0] ?? ('mother' as EstateId)

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const normStatus = (status: unknown): TaskRecord['status'] => {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : ''
  if (normalized === 'in-progress' || normalized === 'done') {
    return normalized
  }
  return 'not-started'
}

const normPriority = (priority: unknown): TaskRecord['priority'] => {
  const normalized = typeof priority === 'string' ? priority.trim().toLowerCase() : ''
  if (normalized === 'low' || normalized === 'high') {
    return normalized
  }
  return 'med'
}

const toDateOnly = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.valueOf())) return null
  return parsed.toISOString().slice(0, 10)
}

const toOptionalString = (value?: string | null) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

const normalizeEstateProfile = (profile: LocalEstateProfile): LocalEstateProfile => ({
  ...profile,
  label: profile.label.trim(),
  county: profile.county.trim(),
  decedentName: profile.decedentName.trim(),
  dodISO: profile.dodISO.trim(),
  lettersISO: toOptionalString(profile.lettersISO) ?? undefined,
  firstPublicationISO: toOptionalString(profile.firstPublicationISO) ?? undefined,
  notes: toOptionalString(profile.notes) ?? undefined,
})

const mapEstateProfileToRow = (profile: LocalEstateProfile, userId: string, updatedAt: string) => ({
  id: profile.id,
  user_id: userId,
  label: toOptionalString(profile.label) ?? null,
  county: toOptionalString(profile.county) ?? null,
  decedent_name: toOptionalString(profile.decedentName) ?? null,
  dod: toDateOnly(profile.dodISO),
  letters: toDateOnly(profile.lettersISO),
  first_publication: toDateOnly(profile.firstPublicationISO),
  notes: toOptionalString(profile.notes) ?? null,
  updated_at: updatedAt,
})

const sanitizeTags = (input: unknown): string[] => {
  if (!Array.isArray(input)) return []
  const normalized = input
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => Boolean(tag))
  return Array.from(new Set(normalized))
}

const sanitizeDocIds = (input: unknown): string[] => {
  if (!Array.isArray(input)) return []
  const normalized = input
    .map((value) => {
      if (typeof value === 'string') return value.trim()
      return typeof value === 'number' ? String(value) : ''
    })
    .filter((value) => value && isUuid(value))
  return Array.from(new Set(normalized))
}

const toIsoString = (value: string | null | undefined) => {
  if (!value) return new Date().toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

const normalizeTaskForLocal = (task: TaskInput & { estateId: EstateId }): TaskInput & { estateId: EstateId } => ({
  estateId: task.estateId,
  title: task.title,
  description: typeof task.description === 'string' ? task.description : '',
  due_date: toIsoString(task.due_date),
  status: normStatus(task.status),
  priority: normPriority(task.priority),
  tags: sanitizeTags(task.tags),
  docIds: sanitizeDocIds(task.docIds),
  seedVersion: task.seedVersion,
})

const normalizeTaskUpdatesForLocal = (
  updates: Partial<Omit<TaskRecord, 'id' | 'created_at' | 'updated_at'>>,
): Partial<Omit<TaskRecord, 'id' | 'created_at' | 'updated_at'>> => {
  const payload: Partial<Omit<TaskRecord, 'id' | 'created_at' | 'updated_at'>> = {}

  if (updates.title !== undefined) payload.title = updates.title
  if (updates.description !== undefined)
    payload.description = typeof updates.description === 'string' ? updates.description : ''
  if (updates.due_date !== undefined) payload.due_date = toIsoString(updates.due_date)
  if (updates.status !== undefined) payload.status = normStatus(updates.status)
  if (updates.priority !== undefined) payload.priority = normPriority(updates.priority)
  if (updates.tags !== undefined) payload.tags = sanitizeTags(updates.tags)
  if (updates.docIds !== undefined) payload.docIds = sanitizeDocIds(updates.docIds)
  if (updates.estateId !== undefined) payload.estateId = updates.estateId
  if ('seedVersion' in updates) payload.seedVersion = updates.seedVersion

  return payload
}

export type CloudFallbackError = Error & {
  cloudFallback: true
  estateId: EstateId
  localId?: string
  taskId?: string
  originalError?: unknown
}

const wrapCloudTaskError = (
  error: unknown,
  estateId: EstateId,
  extras: { localId?: string; taskId?: string } = {},
): CloudFallbackError => {
  const baseMessage =
    error instanceof Error && error.message ? error.message : String(error ?? 'Unknown error')
  const wrapped = new Error(`Cloud save failed: ${baseMessage}`) as CloudFallbackError
  wrapped.cloudFallback = true
  wrapped.estateId = estateId
  if (extras.localId) wrapped.localId = extras.localId
  if (extras.taskId) wrapped.taskId = extras.taskId
  wrapped.originalError = error
  return wrapped
}

export const isCloudFallbackError = (error: unknown): error is CloudFallbackError =>
  Boolean(error && (error as Partial<CloudFallbackError>).cloudFallback)

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

  const metaRow = {
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
  }

  let metaData: SupabaseDocumentMetaRow | null = null
  try {
    const { data } = await insertOrUpdate<SupabaseDocumentMetaRow>(
      'documents_meta',
      { id: payload.id },
      metaRow,
      metaRow,
      { client, userId, select: '*' },
    )
    metaData = (data && data.length > 0 ? data[0] : null) ?? null
  } catch (error) {
    await client.storage.from('documents').remove([storagePath])
    throw error
  }

  const record = mapDocumentMetaRowToRecord((metaData ?? metaRow) as SupabaseDocumentMetaRow)

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

type SyncOptions = { since?: string | null }

export const syncTasksFromCloud = async (estateId: EstateId, options?: SyncOptions) => {
  const context = await getSupabaseContext()
  if (!context) return false
  const { client, userId } = context
  const since = options?.since ?? null

  let query = client.from('tasks').select('*').eq('estate_id', estateId)
  if (since) {
    query = query.gt('updated_at', since).order('updated_at', { ascending: true })
  } else {
    query = query.order('due_date', { ascending: true })
  }

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as SupabaseTaskRow[]

  if (!since) {
    const tasks = rows.map(mapTaskRowToRecord)
    await replaceEstateTasks(estateId, tasks)
    return true
  }

  const handledIds = new Set<string>()

  for (const row of rows) {
    const record = mapTaskRowToRecord(row)
    const existing = await db.tasks.get(record.id)
    if (existing && isoToMillis(existing.updated_at) > isoToMillis(record.updated_at)) {
      const payload = toSupabaseTaskPayload(existing, userId)
      const { data } = await insertOrUpdate<SupabaseTaskRow>(
        'tasks',
        { id: payload.id },
        payload,
        payload,
        { client, userId, select: '*' },
      )

      let upsertedRow = data[0] ?? null
      if (!upsertedRow) {
        const { data: fetched, error: fetchError } = await client
          .from('tasks')
          .select('*')
          .eq('id', payload.id)
          .single()
        if (fetchError) throw fetchError
        upsertedRow = fetched as SupabaseTaskRow
      }

      const merged = mapTaskRowToRecord(upsertedRow)
      await db.tasks.put(merged)
      handledIds.add(merged.id)
      continue
    }

    await db.tasks.put(record)
    handledIds.add(record.id)
  }

  const localUpdates = await db.tasks
    .where('updated_at')
    .above(since)
    .and((task) => task.estateId === estateId)
    .toArray()

  const toSync = localUpdates.filter((task) => !handledIds.has(task.id))

  if (toSync.length > 0) {
    const updatedRows: SupabaseTaskRow[] = []

    for (const task of toSync) {
      const payload = toSupabaseTaskPayload(task, userId)
      const { data } = await insertOrUpdate<SupabaseTaskRow>(
        'tasks',
        { id: payload.id },
        payload,
        payload,
        { client, userId, select: '*' },
      )

      if (data[0]) {
        updatedRows.push(data[0])
        continue
      }

      const { data: fetched, error: fetchError } = await client
        .from('tasks')
        .select('*')
        .eq('id', payload.id)
        .single()
      if (fetchError) throw fetchError
      if (fetched) {
        updatedRows.push(fetched as SupabaseTaskRow)
      }
    }

    if (updatedRows.length > 0) {
      const mapped = updatedRows.map(mapTaskRowToRecord)
      await db.tasks.bulkPut(mapped)
    }
  }

  return true
}

const resolveDueValue = (task: TaskLike) => {
  if (typeof task?.due_date === 'string') return task.due_date
  if (typeof task?.dueISO === 'string') return task.dueISO
  if (typeof task?.dueDate === 'string') return task.dueDate
  return null
}

const buildCloudInsertPayload = (task: TaskLike, estateId: EstateId, userId: string) => {
  const timestamp = nowISO()

  const payload: Record<string, unknown> = {
    user_id: userId,
    estate_id: estateId,
    title: typeof task.title === 'string' ? task.title : '',
    description: typeof task.description === 'string' ? task.description : '',
    due_date: toDateOnly(resolveDueValue(task)),
    status: normStatus(task.status),
    priority: normPriority(task.priority),
    tags: sanitizeTags(task.tags),
    doc_ids: sanitizeDocIds(task.docIds ?? task.doc_ids),
    seed_version: typeof task.seedVersion === 'string' ? task.seedVersion : null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  if (typeof task.id === 'string' && task.id.trim()) {
    payload.id = task.id.trim()
  }

  return payload
}

const buildCloudUpdatePayload = (task: TaskLike, estateId: EstateId) => {
  const patch: Record<string, unknown> = {
    updated_at: nowISO(),
    estate_id: estateId,
  }

  if ('title' in task) patch.title = task.title
  if ('description' in task)
    patch.description = typeof task.description === 'string' ? task.description : ''
  if ('status' in task) patch.status = normStatus(task.status)
  if ('priority' in task) patch.priority = normPriority(task.priority)
  if ('tags' in task) patch.tags = sanitizeTags(task.tags)
  if ('docIds' in task || 'doc_ids' in task) patch.doc_ids = sanitizeDocIds(task.docIds ?? task.doc_ids)
  if ('seedVersion' in task)
    patch.seed_version = typeof task.seedVersion === 'string' ? task.seedVersion : null
  if ('due_date' in task || 'dueISO' in task || 'dueDate' in task) {
    patch.due_date = toDateOnly(resolveDueValue(task))
  }

  return patch
}

export const cloudInsertTask = async (task: TaskLike, estateId: EstateId) => {
  const client = getClient()
  if (!client) throw new Error('Not signed in or cloud disabled')
  const userId = await getUserId(client)
  if (!userId) throw new Error('Not signed in or cloud disabled')

  const payload = buildCloudInsertPayload(task, estateId, userId)
  const { data, error } = await client.from('tasks').insert(payload).select('*').single()
  if (error) throw new Error(error.message)
  return data as SupabaseTaskRow
}

export const cloudUpdateTask = async (task: TaskLike, estateId: EstateId) => {
  if (!task?.id || typeof task.id !== 'string') {
    throw new Error('Task id is required for updates')
  }

  const client = getClient()
  if (!client) throw new Error('Not signed in or cloud disabled')
  const userId = await getUserId(client)
  if (!userId) throw new Error('Not signed in or cloud disabled')

  const patch = buildCloudUpdatePayload(task, estateId)
  const { data, error } = await client
    .from('tasks')
    .update(patch)
    .eq('id', task.id)
    .eq('user_id', userId)
    .eq('estate_id', estateId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as SupabaseTaskRow
}

export const createTask = async (task: TaskInput & { estateId: EstateId }) => {
  const normalized = normalizeTaskForLocal(task)

  if (SAFE_MODE) {
    return createLocalTask(normalized)
  }

  try {
    const inserted = await cloudInsertTask(normalized, normalized.estateId)
    const record = mapTaskRowToRecord(inserted)
    await upsertTaskCache(record)
    return record.id
  } catch (error) {
    const localId = await createLocalTask(normalized)
    throw wrapCloudTaskError(error, normalized.estateId, { localId })
  }
}

export const updateTask = async (
  id: string,
  updates: Partial<Omit<TaskRecord, 'id' | 'created_at' | 'updated_at'>>,
) => {
  const sanitized = normalizeTaskUpdatesForLocal(updates)

  if (SAFE_MODE) {
    await updateLocalTask(id, sanitized)
    return
  }

  const existing = await db.tasks.get(id)
  const estateId = (updates.estateId ?? sanitized.estateId ?? existing?.estateId ?? DEFAULT_ESTATE_ID) as EstateId

  try {
    const updatedRow = await cloudUpdateTask({ id, estateId, ...sanitized }, estateId)
    const record = mapTaskRowToRecord(updatedRow)
    await upsertTaskCache(record)
  } catch (error) {
    await updateLocalTask(id, sanitized)
    throw wrapCloudTaskError(error, estateId, { taskId: id })
  }
}

export const deleteTask = async (id: string) => {
  if (SAFE_MODE) {
    await deleteLocalTask(id)
    return
  }

  const context = await getSupabaseContext()
  if (!context) {
    await deleteLocalTask(id)
    return
  }

  const existing = await db.tasks.get(id)
  const estateId = existing?.estateId ?? DEFAULT_ESTATE_ID
  const { client, userId } = context
  const { error } = await client
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .eq('estate_id', estateId)
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

export const migrateLocalWorkspaceToCloud = async () => {
  const context = await getSupabaseContext()
  if (!context) {
    throw new Error('Supabase session not available')
  }

  const { client, userId } = context

  const profiles = Object.values(loadEstateProfiles())
  for (const profile of profiles) {
    await upsertEstate(profile)
  }

  for (const estateId of ESTATE_IDS) {
    const entries = loadSeedGuidance(estateId)
    const items = entries.map((entry) => {
      const details = entry as Record<string, unknown>
      const body =
        typeof entry.body === 'string'
          ? entry.body
          : typeof details.body === 'string'
          ? (details.body as string)
          : ''
      const links = Array.isArray(details.links) ? details.links : []
      return { title: entry.title, body, links }
    })
    await replaceGuidance(estateId, items, { client, userId })
  }

  const tasks = await db.tasks.toArray()
  if (tasks.length > 0) {
    for (const task of tasks) {
      const payload = toSupabaseTaskPayload(task, userId)
      await insertOrUpdate('tasks', { id: payload.id }, payload, payload, { client, userId })
    }
  }

  const journal = await db.journalEntries.toArray()
  if (journal.length > 0) {
    for (const entry of journal) {
      const payload = toSupabaseJournalPayload(entry, userId)
      await insertOrUpdate('journal', { id: payload.id }, payload, payload, { client, userId })
    }
  }

  await syncEstateProfilesFromCloud()

  await Promise.all(
    ESTATE_IDS.map((estateId) =>
      Promise.all([
        syncGuidanceFromCloud(estateId),
        syncTasksFromCloud(estateId),
        syncJournalFromCloud(estateId),
      ]),
    ),
  )

  const syncTimestamp = nowISO()
  for (const estateId of ESTATE_IDS) {
    setWorkspaceSyncTimestamp(estateId, syncTimestamp)
  }

  return true
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

export const syncWorkspaceFromCloud = async (estateId: EstateId) => {
  const context = await getSupabaseContext()
  if (!context) return false

  const since = getWorkspaceSyncTimestamp(estateId)

  await syncEstateProfilesFromCloud()

  await Promise.all([
    syncGuidanceFromCloud(estateId, { since }),
    syncSeedTasksFromCloud(estateId),
    syncTasksFromCloud(estateId, { since }),
    syncJournalFromCloud(estateId, { since }),
    syncDocumentsFromCloud(estateId),
  ])

  setWorkspaceSyncTimestamp(estateId, nowISO())

  return true
}

export const syncJournalFromCloud = async (estateId: EstateId, options?: SyncOptions) => {
  const context = await getSupabaseContext()
  if (!context) return false
  const { client, userId } = context
  const since = options?.since ?? null

  let query = client.from('journal').select('*').eq('estate_id', estateId).order('created_at', { ascending: false })
  if (since) {
    query = query.gt('created_at', since)
  }

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as SupabaseJournalRow[]
  const entries = rows.map(mapJournalRowToRecord)

  if (!since) {
    await replaceJournalEntries(estateId, entries)
    return true
  }

  if (entries.length > 0) {
    await db.journalEntries.bulkPut(entries)
  }

  const remoteIds = new Set(entries.map((entry) => entry.id))
  const localUpdates = await db.journalEntries
    .where('created_at')
    .above(since)
    .and((entry) => entry.estateId === estateId)
    .toArray()

  const toPush = localUpdates.filter((entry) => !remoteIds.has(entry.id))

  if (toPush.length > 0) {
    const updatedRows: SupabaseJournalRow[] = []

    for (const entry of toPush) {
      const payload = toSupabaseJournalPayload(entry, userId)
      const { data } = await insertOrUpdate<SupabaseJournalRow>(
        'journal',
        { id: payload.id },
        payload,
        payload,
        { client, userId, select: '*' },
      )

      if (data[0]) {
        updatedRows.push(data[0])
        continue
      }

      const { data: fetched, error: fetchError } = await client
        .from('journal')
        .select('*')
        .eq('id', payload.id)
        .single()
      if (fetchError) throw fetchError
      if (fetched) {
        updatedRows.push(fetched as SupabaseJournalRow)
      }
    }

    if (updatedRows.length > 0) {
      const mapped = updatedRows.map(mapJournalRowToRecord)
      await db.journalEntries.bulkPut(mapped)
    }
  }

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

const mapEstateRowToProfile = (row: SupabaseEstateRow, fallback?: LocalEstateProfile): LocalEstateProfile => {
  const base: LocalEstateProfile = fallback
    ? { ...fallback }
    : {
        id: row.id,
        label: toOptionalString(row.label) ?? '',
        county: toOptionalString(row.county) ?? '',
        decedentName: toOptionalString(row.decedent_name) ?? '',
        dodISO: toOptionalString(row.dod) ?? '',
        lettersISO: toOptionalString(row.letters) ?? undefined,
        firstPublicationISO: toOptionalString(row.first_publication) ?? undefined,
        notes: toOptionalString(row.notes) ?? undefined,
      }

  return {
    ...base,
    label: toOptionalString(row.label) ?? base.label,
    county: toOptionalString(row.county) ?? base.county,
    decedentName: toOptionalString(row.decedent_name) ?? base.decedentName,
    dodISO: toOptionalString(row.dod) ?? base.dodISO,
    lettersISO: toOptionalString(row.letters) ?? base.lettersISO,
    firstPublicationISO: toOptionalString(row.first_publication) ?? base.firstPublicationISO,
    notes: toOptionalString(row.notes) ?? base.notes,
  }
}

export const listEstates = async (): Promise<LocalEstateProfile[] | null> => {
  const context = await getSupabaseContext()
  if (!context) return null
  const { client } = context
  const fallback = loadEstateProfiles()
  const { data, error } = await client.from('estates').select('*')
  if (error) throw error
  const rows = (data ?? []) as SupabaseEstateRow[]
  return rows.map((row) => mapEstateRowToProfile(row, fallback[row.id]))
}

export const syncEstateProfilesFromCloud = async () => {
  const estates = await listEstates()
  if (!estates) return false
  const current = loadEstateProfiles()
  const next = { ...current }
  for (const profile of estates) {
    next[profile.id] = profile
  }
  saveEstateProfiles(next)
  return true
}

export const upsertEstate = async (profile: LocalEstateProfile) => {
  const normalized = normalizeEstateProfile(profile)
  const context = await getSupabaseContext()
  if (!context) {
    const current = loadEstateProfiles()
    saveEstateProfiles({ ...current, [normalized.id]: normalized })
    return normalized
  }

  const { client, userId } = context
  const payload = mapEstateProfileToRow(normalized, userId, nowISO())
  await insertOrUpdate('estates', { user_id: userId, id: payload.id }, payload, payload, { client, userId })

  const current = loadEstateProfiles()
  saveEstateProfiles({ ...current, [normalized.id]: normalized })
  return normalized
}

export const updateEstateProfile = async (profile: LocalEstateProfile) => {
  await upsertEstate(profile)
}

const mapGuidanceRowToSeed = (row: SupabaseGuidanceRow): SeedGuidancePage => {
  const entry: SeedGuidancePage = {
    id: row.id,
    title: row.title,
    body: row.body ?? undefined,
  }

    if (row.links && row.links.length > 0) {
      entry.links = row.links
    }

  return entry
}

export const syncGuidanceFromCloud = async (estateId: EstateId, options?: SyncOptions) => {
  const context = await getSupabaseContext()
  if (!context) return false
  const { client } = context
  const since = options?.since ?? null

  let query = client.from('guidance').select('*').eq('estate_id', estateId).order('updated_at', { ascending: true })
  if (since) {
    query = query.gt('updated_at', since)
  }

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as SupabaseGuidanceRow[]
  const entries = rows.map(mapGuidanceRowToSeed)

  if (!since) {
    saveSeedGuidance(estateId, entries)
    return true
  }

  if (entries.length === 0) {
    return true
  }

  const existing = loadSeedGuidance(estateId)
  const merged = [...existing]

  for (const entry of entries) {
    const index = merged.findIndex((candidate) => candidate.id === entry.id)
    if (index >= 0) {
      merged[index] = entry
    } else {
      merged.push(entry)
    }
  }

  saveSeedGuidance(estateId, merged)
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

  for (const profile of plan.profiles) {
    await saveEstate(profile, { client, userId })

    const tasks = plan.seedTasks.filter((task) => task.estateId === profile.id)
    for (const task of tasks) {
      const seedKey = `${profile.id}:${task.title}`
      await saveSeedTask(task, profile.id, seedKey, plan.seedVersion, { client, userId })
    }

    const guides = plan.guidance
      .filter((guide) => guide.estateId === profile.id)
      .map((guide) => ({ title: guide.title, body: guide.body, links: guide.links ?? [] }))
    await replaceGuidance(profile.id, guides, { client, userId })
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
