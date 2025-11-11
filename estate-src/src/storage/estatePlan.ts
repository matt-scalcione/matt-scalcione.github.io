import { Profile as PlanProfile, type PlanV2 } from '../features/plan/planSchema'
import type {
  EstateId,
  EstateProfile,
  SeedDocumentMetadata,
  SeedGuidancePage,
  SeedTask,
} from '../types/estate'
import { isLocalStorageAvailable } from './safeStorage'

const ESTATE_PROFILES_KEY = 'estateProfiles'
const ESTATE_ACTIVE_ID_KEY = 'estateActiveId'
const SEED_VERSION_KEY = 'seedVersion'

const TASKS_KEY_PREFIX = 'tasks:'
const SEED_TASKS_KEY_PREFIX = 'seedTasks:'
const DOCUMENTS_META_KEY_PREFIX = 'documentsMeta:'
const GUIDANCE_KEY_PREFIX = 'guidance:'

export const ESTATE_IDS: EstateId[] = ['mother', 'father']

export const ESTATE_PLAN_UPDATED_EVENT = 'estate-plan-updated'

const dispatchPlanUpdated = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ESTATE_PLAN_UPDATED_EVENT))
}

export const notifyPlanUpdated = () => {
  dispatchPlanUpdated()
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const storageAvailable = () => isLocalStorageAvailable()

const writeJson = (key: string, value: unknown) => {
  if (!storageAvailable()) return
  try {
    if (value === undefined) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Unable to persist storage key ${key}`, error)
  }
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

const tasksKeyFor = (estateId: string) => `${TASKS_KEY_PREFIX}${estateId}`
const seedTasksKeyFor = (estateId: string) => `${SEED_TASKS_KEY_PREFIX}${estateId}`
const documentsKeyFor = (estateId: string) => `${DOCUMENTS_META_KEY_PREFIX}${estateId}`
const guidanceKeyFor = (estateId: string) => `${GUIDANCE_KEY_PREFIX}${estateId}`

const toEstateProfile = (value: unknown, id: EstateId): EstateProfile => {
  if (!isRecord(value)) {
    throw new Error(`Estate profile for ${id} is invalid`)
  }

  const parsed = PlanProfile.safeParse({ id, ...value })
  if (!parsed.success) {
    throw new Error(`Estate profile for ${id} is invalid`)
  }

  const data = parsed.data

  return {
    id,
    label: data.label,
    county: data.county,
    decedentName: data.decedentName,
    dodISO: data.dodISO,
    lettersISO: data.lettersISO ?? undefined,
    firstPublicationISO: data.firstPublicationISO ?? undefined,
    notes: data.notes ?? undefined,
  }
}

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
        result[id] = toEstateProfile(value, id)
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

export const loadSeedTasks = (estateId: EstateId): SeedTask[] => {
  const fromNewKey = readJson<SeedTask[] | null>(seedTasksKeyFor(estateId), null)
  if (Array.isArray(fromNewKey)) {
    return fromNewKey
  }

  return readJson<SeedTask[]>(tasksKeyFor(estateId), [])
}

export const loadSeedDocumentsMeta = (estateId: EstateId): SeedDocumentMetadata[] =>
  readJson<SeedDocumentMetadata[]>(documentsKeyFor(estateId), [])

export const loadSeedGuidance = (estateId: EstateId): SeedGuidancePage[] =>
  readJson<SeedGuidancePage[]>(guidanceKeyFor(estateId), [])

export const saveSeedTasks = (estateId: EstateId, tasks: SeedTask[]) => {
  writeJson(seedTasksKeyFor(estateId), tasks)
}

export const saveSeedGuidance = (estateId: EstateId, entries: SeedGuidancePage[]) => {
  writeJson(guidanceKeyFor(estateId), entries)
}

export const loadSeedVersion = (): string | null => {
  if (!storageAvailable()) return null
  try {
    return window.localStorage.getItem(SEED_VERSION_KEY)
  } catch (error) {
    console.warn('Unable to read seed version from storage', error)
    return null
  }
}

export const getActiveEstateId = (): EstateId => {
  if (!storageAvailable()) return 'mother'
  try {
    const stored = window.localStorage.getItem(ESTATE_ACTIVE_ID_KEY)
    if (stored === 'mother' || stored === 'father') {
      return stored
    }
  } catch (error) {
    console.warn('Unable to read active estate id from storage', error)
  }
  return 'mother'
}

export const setActiveEstateId = (estateId: EstateId) => {
  if (!storageAvailable()) return
  try {
    window.localStorage.setItem(ESTATE_ACTIVE_ID_KEY, estateId)
  } catch (error) {
    console.warn('Unable to persist active estate id', error)
  }
}

export function reseedFromPlan(plan: PlanV2) {
  if (!storageAvailable()) return

  for (const profile of plan.profiles) {
    const key = tasksKeyFor(profile.id)
    let existing: any[] = []

    try {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          existing = parsed
        }
      }
    } catch (error) {
      console.warn(`Unable to parse existing tasks for ${profile.id}`, error)
    }

    const isSeed = (task: any) => isRecord(task) && isRecord(task._seed) && task._seed.v === plan.seedVersion
    const keep = existing.filter((task) => !isSeed(task))

    const now = new Date().toISOString()
    const seeded = plan.seedTasks
      .filter((task) => task.estateId === profile.id)
      .map((task) => ({
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${plan.seedVersion}-${Math.random().toString(36).slice(2)}`,
        title: task.title,
        description: task.description ?? '',
        due_date: task.dueISO ?? null,
        status: task.status ?? 'not-started',
        priority: task.priority ?? 'med',
        tags: task.tags ?? [],
        created_at: now,
        updated_at: now,
        estateId: profile.id,
        _seed: { v: plan.seedVersion, k: `${profile.id}:${task.title}` },
      }))

    window.localStorage.setItem(key, JSON.stringify([...keep, ...seeded]))
  }
}

export const saveEstateProfiles = (profiles: Record<string, unknown>) => {
  writeJson(ESTATE_PROFILES_KEY, profiles)
}

export const saveSeedVersion = (seedVersion: string) => {
  if (!storageAvailable()) return
  window.localStorage.setItem(SEED_VERSION_KEY, seedVersion)
}
