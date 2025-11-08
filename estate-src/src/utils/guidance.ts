import { SeedGuidancePage } from '../types/estate'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toStringOrUndefined = (value: unknown) =>
  typeof value === 'string' ? value.trim() || undefined : undefined

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export const guidanceAnchorForId = (id: string) => `guide-${slugify(id || 'guidance')}`

export interface GuidanceStep {
  title?: string
  detail?: string
}

export interface GuidanceTemplate {
  id: string
  title: string
  body: string
}

export interface GuidanceLink {
  id: string
  label: string
  url: string
  description?: string
}

export interface NormalizedGuidanceEntry {
  id: string
  anchor: string
  title: string
  summary?: string
  body?: string
  steps: GuidanceStep[]
  notes: string[]
  templates: GuidanceTemplate[]
  links: GuidanceLink[]
  copyText: string
}

const normalizeStep = (value: unknown): GuidanceStep | null => {
  if (typeof value === 'string') {
    return { detail: value.trim() }
  }

  if (isRecord(value)) {
    const title = toStringOrUndefined(value.title) ?? toStringOrUndefined(value.label)
    const detail =
      toStringOrUndefined(value.detail) ??
      toStringOrUndefined(value.description) ??
      toStringOrUndefined(value.body) ??
      toStringOrUndefined(value.text)

    if (!title && !detail) {
      return null
    }

    return { title, detail }
  }

  return null
}

const normalizeTemplate = (value: unknown, index: number): GuidanceTemplate | null => {
  if (typeof value === 'string') {
    return {
      id: `template-${index}`,
      title: `Template ${index + 1}`,
      body: value.trim(),
    }
  }

  if (isRecord(value)) {
    const body =
      toStringOrUndefined(value.body) ??
      toStringOrUndefined(value.text) ??
      toStringOrUndefined(value.template)

    if (!body) {
      return null
    }

    const title =
      toStringOrUndefined(value.title) ??
      toStringOrUndefined(value.label) ??
      `Template ${index + 1}`

    const id = toStringOrUndefined(value.id) ?? `template-${index}`

    return { id, title, body }
  }

  return null
}

const normalizeLink = (value: unknown, index: number): GuidanceLink | null => {
  if (!isRecord(value)) {
    return null
  }

  const url = toStringOrUndefined(value.url) ?? toStringOrUndefined(value.href)
  if (!url) {
    return null
  }

  const label =
    toStringOrUndefined(value.label) ??
    toStringOrUndefined(value.title) ??
    url

  const description =
    toStringOrUndefined(value.description) ?? toStringOrUndefined(value.summary)

  const id = toStringOrUndefined(value.id) ?? `link-${index}`

  return { id, label, url, description }
}

const gatherSteps = (entry: SeedGuidancePage): GuidanceStep[] => {
  const stepKeys = ['steps', 'instructions', 'checklist', 'items', 'actions']
  const steps: GuidanceStep[] = []

  for (const key of stepKeys) {
    const raw = (entry as Record<string, unknown>)[key]
    if (!raw) continue

    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        const step = normalizeStep(item)
        if (step) {
          steps.push(step)
        }
      })
    } else {
      const step = normalizeStep(raw)
      if (step) {
        steps.push(step)
      }
    }
  }

  return steps
}

const gatherTemplates = (entry: SeedGuidancePage): GuidanceTemplate[] => {
  const templateKeys = ['templates', 'template', 'prefilled', 'prefillTemplates']
  const templates: GuidanceTemplate[] = []

  templateKeys.forEach((key) => {
    const raw = (entry as Record<string, unknown>)[key]
    if (!raw) return

    const append = (value: unknown, index: number) => {
      const template = normalizeTemplate(value, templates.length + index)
      if (template) {
        templates.push(template)
      }
    }

    if (Array.isArray(raw)) {
      raw.forEach((value, index) => append(value, index))
    } else {
      append(raw, 0)
    }
  })

  return templates
}

const gatherLinks = (entry: SeedGuidancePage): GuidanceLink[] => {
  const linkKeys = ['links', 'resources']
  const links: GuidanceLink[] = []

  linkKeys.forEach((key) => {
    const raw = (entry as Record<string, unknown>)[key]
    if (!raw) return

    const append = (value: unknown, index: number) => {
      const link = normalizeLink(value, links.length + index)
      if (link) {
        links.push(link)
      }
    }

    if (Array.isArray(raw)) {
      raw.forEach((value, index) => append(value, index))
    } else {
      append(raw, 0)
    }
  })

  return links
}

const gatherNotes = (entry: SeedGuidancePage): string[] => {
  const notes: string[] = []

  Object.entries(entry).forEach(([key, value]) => {
    if (typeof value !== 'string') return
    const lower = key.toLowerCase()
    if (['note', 'notes', 'deadlineNote', 'reminder'].some((needle) => lower.includes(needle))) {
      if (key === 'summary' || key === 'body') return
      const trimmed = value.trim()
      if (trimmed) {
        notes.push(trimmed)
      }
    }
  })

  return notes
}

const buildCopyText = (entry: {
  title: string
  summary?: string
  body?: string
  steps: GuidanceStep[]
  notes: string[]
  templates: GuidanceTemplate[]
}) => {
  const sections: string[] = [entry.title]

  if (entry.summary) {
    sections.push(entry.summary)
  }

  if (entry.body) {
    sections.push(entry.body)
  }

  if (entry.steps.length > 0) {
    const stepsText = entry.steps
      .map((step, index) => {
        const prefix = `${index + 1}.`
        if (step.title && step.detail) {
          return `${prefix} ${step.title}\n   ${step.detail}`
        }
        if (step.title) {
          return `${prefix} ${step.title}`
        }
        return `${prefix} ${step.detail ?? ''}`.trim()
      })
      .join('\n')

    sections.push(stepsText)
  }

  if (entry.notes.length > 0) {
    sections.push(entry.notes.join('\n'))
  }

  if (entry.templates.length > 0) {
    entry.templates.forEach((template) => {
      sections.push(`${template.title}\n${template.body}`.trim())
    })
  }

  return sections
    .map((section) => section.trim())
    .filter(Boolean)
    .join('\n\n')
}

export const normalizeGuidanceEntries = (entries: SeedGuidancePage[]): NormalizedGuidanceEntry[] => {
  return entries.map((entry, index) => {
    const title = toStringOrUndefined(entry.title) ?? `Guidance ${index + 1}`
    const id = toStringOrUndefined(entry.id) ?? slugify(title)
    const summary = toStringOrUndefined((entry as Record<string, unknown>).summary)
    const body = toStringOrUndefined((entry as Record<string, unknown>).body)
    const steps = gatherSteps(entry)
    const notes = gatherNotes(entry)
    const templates = gatherTemplates(entry)
    const links = gatherLinks(entry)
    const copyText = buildCopyText({ title, summary, body, steps, notes, templates }) || title

    return {
      id,
      anchor: guidanceAnchorForId(id),
      title,
      summary,
      body,
      steps,
      notes,
      templates,
      links,
      copyText,
    }
  })
}

