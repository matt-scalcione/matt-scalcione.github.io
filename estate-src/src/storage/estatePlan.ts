import { createTask, db, updateTask } from './tasksDB'
import {
  EstateId,
  EstateProfile,
  SeedDocumentMetadata,
  SeedGuidancePage,
  SeedTask,
} from '../types/estate'

const ESTATE_PROFILES_KEY = 'estateProfiles'
const ESTATE_ACTIVE_ID_KEY = 'estateActiveId'
const SEED_VERSION_KEY = 'seedVersion'

const TASKS_KEY_PREFIX = 'tasks:'
const DOCUMENTS_META_KEY_PREFIX = 'documentsMeta:'
const GUIDANCE_KEY_PREFIX = 'guidance:'

export const ESTATE_IDS: EstateId[] = ['mother', 'father']

export const ESTATE_PLAN_UPDATED_EVENT = 'estate-plan-updated'

const dispatchPlanUpdated = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ESTATE_PLAN_UPDATED_EVENT))
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isEstateId = (value: unknown): value is EstateId =>
  typeof value === 'string' && ESTATE_IDS.includes(value as EstateId)

const isSeedLink = (value: unknown): value is NonNullable<SeedTask['linkTo']>[number] =>
  isRecord(value) && typeof value.type === 'string' && typeof value.value === 'string'

const validateSeedTask = (task: unknown): SeedTask => {
  if (!isRecord(task)) {
    throw new Error('Invalid task entry in plan payload')
  }

  const { title, description, tags, dueISO, status, priority, linkTo } = task

  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Seed task requires a title')
  }

  if (typeof description !== 'string') {
    throw new Error(`Seed task "${title}" requires a description`)
  }

  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string')) {
    throw new Error(`Seed task "${title}" must include an array of string tags`)
  }

  if (dueISO !== undefined && typeof dueISO !== 'string') {
    throw new Error(`Seed task "${title}" has an invalid due date`)
  }

  if (
    status !== undefined &&
    status !== 'not-started' &&
    status !== 'in-progress' &&
    status !== 'done'
  ) {
    throw new Error(`Seed task "${title}" has an invalid status`)
  }

  if (priority !== undefined && priority !== 'low' && priority !== 'med' && priority !== 'high') {
    throw new Error(`Seed task "${title}" has an invalid priority`)
  }

  if (linkTo !== undefined) {
    if (!Array.isArray(linkTo) || linkTo.some((entry) => !isSeedLink(entry))) {
      throw new Error(`Seed task "${title}" has invalid link targets`)
    }
  }

  return {
    title,
    description,
    tags: tags.map((tag) => tag.trim()).filter(Boolean),
    dueISO: dueISO ?? undefined,
    status,
    priority,
    linkTo,
  }
}

const validateEstateProfile = (profile: unknown, id: EstateId): EstateProfile => {
  if (!isRecord(profile)) {
    throw new Error(`Estate profile for ${id} is invalid`)
  }

  const { label, county, decedentName, dodISO, lettersISO, firstPublicationISO, notes } = profile

  if (typeof label !== 'string' || !label.trim()) {
    throw new Error(`Estate profile for ${id} requires a label`)
  }

  if (typeof county !== 'string' || !county.trim()) {
    throw new Error(`Estate profile for ${id} requires a county`)
  }

  if (typeof decedentName !== 'string' || !decedentName.trim()) {
    throw new Error(`Estate profile for ${id} requires a decedent name`)
  }

  if (typeof dodISO !== 'string' || !dodISO.trim()) {
    throw new Error(`Estate profile for ${id} requires a date of death`)
  }

  if (lettersISO !== undefined && typeof lettersISO !== 'string') {
    throw new Error(`Estate profile for ${id} has an invalid letters date`)
  }

  if (firstPublicationISO !== undefined && typeof firstPublicationISO !== 'string') {
    throw new Error(`Estate profile for ${id} has an invalid publication date`)
  }

  if (notes !== undefined && typeof notes !== 'string') {
    throw new Error(`Estate profile for ${id} has invalid notes`)
  }

  return {
    id,
    label,
    county,
    decedentName,
    dodISO,
    lettersISO: lettersISO ?? undefined,
    firstPublicationISO: firstPublicationISO ?? undefined,
    notes: notes ?? undefined,
  }
}

export interface EstatePlanPayload {
  seedVersion: string
  estateProfiles: Partial<Record<EstateId, EstateProfile>>
  tasks?: Partial<Record<EstateId, SeedTask[]>>
  documentsMeta?: Partial<Record<EstateId, SeedDocumentMetadata[]>>
  guidance?: Partial<Record<EstateId, SeedGuidancePage[]>>
}

export interface EstatePlan {
  seedVersion: string
  estateProfiles: Record<EstateId, EstateProfile>
  tasks: Record<EstateId, SeedTask[]>
  documentsMeta: Record<EstateId, SeedDocumentMetadata[]>
  guidance: Record<EstateId, SeedGuidancePage[]>
}

const normalizePlan = (raw: unknown): EstatePlan => {
  if (!isRecord(raw)) {
    throw new Error('Plan payload must be an object')
  }

  const { seedVersion, estateProfiles, tasks, documentsMeta, guidance } = raw

  if (typeof seedVersion !== 'string' || !seedVersion.trim()) {
    throw new Error('Plan payload requires a seedVersion string')
  }

  if (!isRecord(estateProfiles)) {
    throw new Error('Plan payload requires estateProfiles')
  }

  const normalizedProfiles: Record<EstateId, EstateProfile> = {
    mother: validateEstateProfile(estateProfiles.mother, 'mother'),
    father: validateEstateProfile(estateProfiles.father, 'father'),
  }

  const normalizedTasks: Record<EstateId, SeedTask[]> = { mother: [], father: [] }
  if (tasks !== undefined) {
    if (!isRecord(tasks)) {
      throw new Error('Plan payload tasks section must be an object')
    }
    for (const id of ESTATE_IDS) {
      const entries = tasks[id]
      if (entries === undefined) {
        normalizedTasks[id] = []
        continue
      }
      if (!Array.isArray(entries)) {
        throw new Error(`Plan payload tasks for ${id} must be an array`)
      }
      normalizedTasks[id] = entries.map((entry) => validateSeedTask(entry))
    }
  }

  const normalizedDocuments: Record<EstateId, SeedDocumentMetadata[]> = { mother: [], father: [] }
  if (documentsMeta !== undefined) {
    if (!isRecord(documentsMeta)) {
      throw new Error('Plan payload documentsMeta must be an object')
    }
    for (const id of ESTATE_IDS) {
      const entries = documentsMeta[id]
      if (entries === undefined) {
        normalizedDocuments[id] = []
        continue
      }
      if (!Array.isArray(entries)) {
        throw new Error(`Plan payload documentsMeta for ${id} must be an array`)
      }
      normalizedDocuments[id] = entries.filter((entry): entry is SeedDocumentMetadata => isRecord(entry)) as SeedDocumentMetadata[]
    }
  }

  const normalizedGuidance: Record<EstateId, SeedGuidancePage[]> = { mother: [], father: [] }
  if (guidance !== undefined) {
    if (!isRecord(guidance)) {
      throw new Error('Plan payload guidance must be an object')
    }
    for (const id of ESTATE_IDS) {
      const entries = guidance[id]
      if (entries === undefined) {
        normalizedGuidance[id] = []
        continue
      }
      if (!Array.isArray(entries)) {
        throw new Error(`Plan payload guidance for ${id} must be an array`)
      }
      normalizedGuidance[id] = entries.filter((entry): entry is SeedGuidancePage => isRecord(entry)) as SeedGuidancePage[]
    }
  }

  return {
    seedVersion: seedVersion.trim(),
    estateProfiles: normalizedProfiles,
    tasks: normalizedTasks,
    documentsMeta: normalizedDocuments,
    guidance: normalizedGuidance,
  }
}

const storageAvailable = () => typeof window !== 'undefined' && !!window.localStorage

const writeJson = (key: string, value: unknown) => {
  if (!storageAvailable()) return
  if (value === undefined) {
    window.localStorage.removeItem(key)
    return
  }
  window.localStorage.setItem(key, JSON.stringify(value))
}

const readJson = <T>(key: string, fallback: T): T => {
  if (!storageAvailable()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn(`Unable to parse storage key ${key}`, error)
    return fallback
  }
}

const tasksKeyFor = (estateId: EstateId) => `${TASKS_KEY_PREFIX}${estateId}`
const documentsKeyFor = (estateId: EstateId) => `${DOCUMENTS_META_KEY_PREFIX}${estateId}`
const guidanceKeyFor = (estateId: EstateId) => `${GUIDANCE_KEY_PREFIX}${estateId}`

export const loadEstateProfiles = (): Record<EstateId, EstateProfile> => {
  const fallback: Record<EstateId, EstateProfile> = {
    mother: {
      id: 'mother',
      label: 'Mother',
      county: '',
      decedentName: '',
      dodISO: '',
    },
    father: {
      id: 'father',
      label: 'Father',
      county: '',
      decedentName: '',
      dodISO: '',
    },
  }

  if (!storageAvailable()) {
    return fallback
  }

  const stored = window.localStorage.getItem(ESTATE_PROFILES_KEY)
  if (!stored) {
    return fallback
  }

  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>
    const result: Record<EstateId, EstateProfile> = { ...fallback }

    for (const id of ESTATE_IDS) {
      const value = parsed[id]
      if (!value) continue
      try {
        result[id] = validateEstateProfile(value, id)
      } catch (error) {
        console.warn(`Ignoring invalid estate profile for ${id}`, error)
      }
    }

    return result
  } catch (error) {
    console.warn('Unable to parse estate profiles from storage', error)
    return fallback
  }
}

export const loadSeedTasks = (estateId: EstateId): SeedTask[] => readJson<SeedTask[]>(tasksKeyFor(estateId), [])

export const loadSeedDocumentsMeta = (estateId: EstateId): SeedDocumentMetadata[] =>
  readJson<SeedDocumentMetadata[]>(documentsKeyFor(estateId), [])

export const loadSeedGuidance = (estateId: EstateId): SeedGuidancePage[] =>
  readJson<SeedGuidancePage[]>(guidanceKeyFor(estateId), [])

export const loadSeedVersion = (): string | null => {
  if (!storageAvailable()) return null
  return window.localStorage.getItem(SEED_VERSION_KEY)
}

export const getActiveEstateId = (): EstateId => {
  if (!storageAvailable()) return 'mother'
  const stored = window.localStorage.getItem(ESTATE_ACTIVE_ID_KEY)
  if (isEstateId(stored)) {
    return stored
  }
  return 'mother'
}

export const setActiveEstateId = (estateId: EstateId) => {
  if (!storageAvailable()) return
  window.localStorage.setItem(ESTATE_ACTIVE_ID_KEY, estateId)
}

export const persistEstatePlan = (rawPlan: unknown) => {
  const plan = normalizePlan(rawPlan)
  if (!storageAvailable()) return plan

  writeJson(ESTATE_PROFILES_KEY, plan.estateProfiles)
  window.localStorage.setItem(SEED_VERSION_KEY, plan.seedVersion)

  for (const id of ESTATE_IDS) {
    const tasks = plan.tasks[id]
    if (tasks.length === 0) {
      window.localStorage.removeItem(tasksKeyFor(id))
    } else {
      writeJson(tasksKeyFor(id), tasks)
    }

    const docs = plan.documentsMeta[id]
    if (docs.length === 0) {
      window.localStorage.removeItem(documentsKeyFor(id))
    } else {
      writeJson(documentsKeyFor(id), docs)
    }

    const guides = plan.guidance[id]
    if (guides.length === 0) {
      window.localStorage.removeItem(guidanceKeyFor(id))
    } else {
      writeJson(guidanceKeyFor(id), guides)
    }
  }

  const currentActive = getActiveEstateId()
  if (!isEstateId(currentActive)) {
    setActiveEstateId('mother')
  }

  dispatchPlanUpdated()

  return plan
}

export interface ReseedOptions {
  replaceExistingWithSameSeedVersion?: boolean
}

export const reseedFromPlan = async (plan: EstatePlan, options?: ReseedOptions) => {
  const replaceExisting = options?.replaceExistingWithSameSeedVersion ?? false

  for (const estateId of ESTATE_IDS) {
    const seeds = plan.tasks[estateId]
    if (!seeds || seeds.length === 0) continue

    const existing = await db.tasks.where('estateId').equals(estateId).toArray()
    const matches = new Map<string, typeof existing[number]>()

    if (replaceExisting) {
      existing.forEach((task) => {
        if (task.seedVersion === plan.seedVersion) {
          matches.set(task.title.trim().toLowerCase(), task)
        }
      })
    }

    for (const seed of seeds) {
      const key = seed.title.trim().toLowerCase()
      const current = matches.get(key)

      if (current) {
        const updates: Parameters<typeof updateTask>[1] = {
          title: seed.title,
          description: seed.description,
          status: seed.status ?? current.status,
          priority: seed.priority ?? current.priority,
          tags: seed.tags,
          seedVersion: plan.seedVersion,
        }
        if (seed.dueISO) {
          updates.due_date = seed.dueISO
        }
        await updateTask(current.id, updates)
      } else {
        await createTask({
          estateId,
          title: seed.title,
          description: seed.description,
          due_date: seed.dueISO ?? new Date().toISOString(),
          status: seed.status ?? 'not-started',
          priority: seed.priority ?? 'med',
          tags: seed.tags,
          seedVersion: plan.seedVersion,
        })
      }
    }
  }
}

export { normalizePlan as parsePlanPayload }
