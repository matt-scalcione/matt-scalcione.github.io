import { z } from 'zod'

const iso = z
  .string()
  .datetime({ offset: false })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .or(z.literal('').transform(() => null))

const linkUrl = z
  .string()
  .refine(
    (s) => /^(https?:\/\/|mailto:|tel:|\/)/i.test(String(s || '').trim()),
    'link must start with http(s)://, mailto:, tel:, or /',
  )

export const Profile = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  county: z.string().min(1),
  decedentName: z.string().min(1),
  dodISO: iso,
  lettersISO: iso.nullable().optional(),
  firstPublicationISO: iso.nullable().optional(),
  notes: z.string().optional(),
})

export const SeedTask = z.object({
  estateId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  dueISO: iso.nullable().optional(),
  status: z.enum(['not-started', 'in-progress', 'done']).optional().default('not-started'),
  priority: z.enum(['low', 'med', 'high']).optional().default('med'),
})

export const Guidance = z.object({
  estateId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  links: z
    .array(
      z.union([
        z.object({ label: z.string().min(1), url: linkUrl }),
        z.string().transform((u) => ({ label: u, url: u })),
      ]),
    )
    .optional()
    .default([]),
})

export const PlanV2 = z.object({
  seedVersion: z.string().min(1),
  profiles: z.array(Profile).min(1),
  seedTasks: z.array(SeedTask).default([]),
  guidance: z.array(Guidance).default([]),
})

export type PlanV2 = z.infer<typeof PlanV2>

// Accept older/alternate keys and normalize to PlanV2
type MutablePlan = {
  profiles?: unknown
  estateProfiles?: Record<string, Record<string, unknown>>
  seedTasks?: unknown
  tasks?: unknown
  guidance?: unknown
  guidancePages?: unknown
}

type UnknownRecord = Record<string, unknown>

export function coercePlan(raw: unknown) {
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw

  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const plan = obj as MutablePlan

  // synonyms
  if (plan.estateProfiles && !plan.profiles) {
    const rec = plan.estateProfiles
    plan.profiles = (Object.keys(rec) as string[]).map((id) => ({ id, ...rec[id] }))
  }
  if (plan.tasks && !plan.seedTasks) {
    plan.seedTasks = plan.tasks
  }
  if (plan.guidancePages && !plan.guidance) {
    plan.guidance = plan.guidancePages
  }

  const profilesArray = Array.isArray(plan.profiles) ? (plan.profiles as UnknownRecord[]) : []
  const seedTasksArray = Array.isArray(plan.seedTasks) ? (plan.seedTasks as UnknownRecord[]) : []
  const guidanceArray = Array.isArray(plan.guidance) ? (plan.guidance as UnknownRecord[]) : []

  plan.profiles = profilesArray
  plan.seedTasks = seedTasksArray
  plan.guidance = guidanceArray

  // coerce null/empty strings on date fields
  const fix = (v: unknown) => (v === '' ? null : v)
  plan.profiles = profilesArray.map((profile) => {
    const record = profile ?? {}
    const source = record as UnknownRecord
    return {
      ...profile,
      lettersISO: fix(source.lettersISO ?? null),
      firstPublicationISO: fix(source.firstPublicationISO ?? null),
    }
  })
  plan.seedTasks = seedTasksArray.map((task) => {
    const record = task ?? {}
    const source = record as UnknownRecord
    return {
      ...task,
      dueISO: fix(source.dueISO ?? null),
    }
  })

  plan.guidance = guidanceArray.map((entry) => {
    const record = entry ?? {}
    const source = record as UnknownRecord & { links?: unknown }
    const linksSource = Array.isArray(source.links) ? source.links : []

    return {
      ...entry,
      links: linksSource.map((link) => {
        if (typeof link === 'string') {
          return link.trim()
        }

        const linkRecord = link && typeof link === 'object' ? (link as UnknownRecord) : {}

        return {
          ...linkRecord,
          label: String(linkRecord.label ?? '').trim(),
          url: String(linkRecord.url ?? '').trim(),
        }
      }),
    }
  })

  return obj
}
