import type { SupabaseClient } from '@supabase/supabase-js'
import { getClient, getSupabaseSession } from '../lib/supabaseClient'
import {
  db,
  type DocumentRecord,
  type JournalEntryInput,
  type JournalEntryRecord,
  type TaskInput,
  type TaskRecord,
} from '../storage/tasksDB'
import {
  loadEstateProfiles,
  saveEstateProfiles,
  saveSeedGuidance,
  saveSeedTasks,
  saveSeedVersion,
} from '../storage/estatePlan'
import type { EstateId, EstateProfile, SeedGuidancePage, SeedTask } from '../types/estate'
import {
  createTask as createLocalTask,
  deleteTask as deleteLocalTask,
  updateTask as updateLocalTask,
  createJournalEntry as createLocalJournalEntry,
  deleteJournalEntry as deleteLocalJournalEntry,
  updateJournalEntry as updateLocalJournalEntry,
  linkDocumentToTask as linkDocumentToTaskLocal,
  unlinkDocumentFromTask as unlinkDocumentFromTaskLocal,
} from '../storage/tasksDB'
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

  const currentDocIds = await resolveTaskDocIds(taskId)
  const docIds = Array.from(new Set([...currentDocIds, docId]))

  await updateTask(taskId, { docIds })

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

  const doc = (await db.documents.get(docId)) as DocumentRecord | undefined
  if (doc?.taskId) {
    const currentDocIds = await resolveTaskDocIds(doc.taskId)
    const docIds = currentDocIds.filter((id) => id !== docId)
    await updateTask(doc.taskId, { docIds })
  }
  await db.documents.update(docId, { taskId: null })
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
