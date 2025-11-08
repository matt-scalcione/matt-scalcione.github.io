export type EstateId = 'mother' | 'father'

export interface EstateProfile {
  id: EstateId
  label: string
  county: string
  decedentName: string
  dodISO: string
  lettersISO?: string
  firstPublicationISO?: string
  notes?: string
}

export type SeedLinkTargetType = 'doc' | 'url' | 'task'

export interface SeedLinkTarget {
  type: SeedLinkTargetType
  value: string
}

export interface SeedTask {
  title: string
  description: string
  tags: string[]
  dueISO?: string
  status?: 'not-started' | 'in-progress' | 'done'
  priority?: 'low' | 'med' | 'high'
  linkTo?: SeedLinkTarget[]
}

export interface SeedDocumentMetadata {
  id: string
  title: string
  description?: string
  tags?: string[]
  linkTo?: SeedLinkTarget[]
  [key: string]: unknown
}

export interface SeedGuidancePage {
  id: string
  title: string
  summary?: string
  body?: string
  tags?: string[]
  [key: string]: unknown
}
