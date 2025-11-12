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
export function coercePlan(raw: unknown) {
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw

  if (!obj || typeof obj !== 'object') {
    return obj
  }

  // synonyms
  if ((obj as Record<string, unknown>).estateProfiles && !(obj as Record<string, unknown>).profiles) {
    const rec = (obj as { estateProfiles: Record<string, any> }).estateProfiles
    ;(obj as { profiles: any[] }).profiles = Object.keys(rec).map((id) => ({ id, ...rec[id] }))
  }
  if ((obj as Record<string, unknown>).tasks && !(obj as Record<string, unknown>).seedTasks) {
    ;(obj as { seedTasks: unknown[] }).seedTasks = (obj as { tasks: unknown[] }).tasks
  }
  if ((obj as Record<string, unknown>).guidancePages && !(obj as Record<string, unknown>).guidance) {
    ;(obj as { guidance: unknown[] }).guidance = (obj as { guidancePages: unknown[] }).guidancePages
  }

  // ensure required arrays exist
  if (!(obj as Record<string, unknown>).profiles) {
    ;(obj as { profiles: unknown[] }).profiles = []
  }
  if (!(obj as Record<string, unknown>).seedTasks) {
    ;(obj as { seedTasks: unknown[] }).seedTasks = []
  }
  if (!(obj as Record<string, unknown>).guidance) {
    ;(obj as { guidance: unknown[] }).guidance = []
  }

  // coerce null/empty strings on date fields
  const fix = (v: unknown) => (v === '' ? null : v)
  ;(obj as { profiles: any[] }).profiles = (obj as { profiles: any[] }).profiles.map((p) => ({
    ...p,
    lettersISO: fix((p as Record<string, unknown>).lettersISO ?? null),
    firstPublicationISO: fix((p as Record<string, unknown>).firstPublicationISO ?? null),
  }))
  ;(obj as { seedTasks: any[] }).seedTasks = (obj as { seedTasks: any[] }).seedTasks.map((t) => ({
    ...t,
    dueISO: fix((t as Record<string, unknown>).dueISO ?? null),
  }))

  if ((obj as { guidance?: any[] }).guidance) {
    ;(obj as { guidance: any[] }).guidance = (obj as { guidance: any[] }).guidance.map((g) => ({
      ...g,
      links: ((g as Record<string, unknown>).links || []).map((link: any) =>
        typeof link === 'string'
          ? link.trim()
          : {
              ...link,
              label: String((link as Record<string, unknown>).label ?? '').trim(),
              url: String((link as Record<string, unknown>).url ?? '').trim(),
            },
      ),
    }))
  }

  return obj
}
