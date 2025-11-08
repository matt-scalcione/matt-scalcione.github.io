export type TaskCategory =
  | 'Legal'
  | 'Tax'
  | 'Property'
  | 'Financial'
  | 'Comms'
  | 'Other'

export type TaskStatus = 'Todo' | 'InProgress' | 'Blocked' | 'Done'

export interface LinkedIds {
  documents?: string[]
  assets?: string[]
  expenses?: string[]
}

export interface Task {
  id: string
  title: string
  description?: string
  category: TaskCategory
  tags: string[]
  status: TaskStatus
  dueDate?: string
  assignedTo?: string[]
  relatedIds?: LinkedIds
  createdAt: string
  updatedAt: string
  templateKey?: string
}

export type DocumentTag = 'Legal' | 'Tax' | 'Property' | 'Receipts' | 'Bank' | 'ID' | 'Other'

export interface DocumentRecord {
  id: string
  filename: string
  mimeType: string
  size: number
  title?: string
  notes?: string
  tags: DocumentTag[]
  createdAt: string
  updatedAt?: string
  blobRef: string
}

export interface DocumentBlob {
  id: string
  blob: Blob
}

export type AssetCategory =
  | 'RealEstate'
  | 'Vehicle'
  | 'Bank'
  | 'Retirement'
  | 'Brokerage'
  | 'PersonalProperty'
  | 'LifeInsurance'
  | 'Other'

export interface AssetRecord {
  id: string
  category: AssetCategory
  description: string
  probate: boolean
  paInheritanceTaxable: boolean
  ownershipNote?: string
  dodValue?: number
  valuationNotes?: string
  documents?: string[]
  disposed?: boolean
  disposedNote?: string
  createdAt: string
  updatedAt: string
}

export type ExpenseCategory =
  | 'Funeral'
  | 'Utilities'
  | 'Maintenance'
  | 'CourtFees'
  | 'Professional'
  | 'Tax'
  | 'Other'

export interface ExpenseRecord {
  id: string
  date: string
  payee: string
  description: string
  category: ExpenseCategory
  amount: number
  paidFrom: 'Estate' | 'ExecutorAdvance'
  reimbursed: boolean
  notes?: string
  receiptId?: string
  createdAt: string
  updatedAt: string
}

export interface BeneficiaryRecord {
  id: string
  name: string
  relation: string
  email?: string
  phone?: string
  address?: string
  sharePct?: number
  rule10_5NoticeSentDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface EstateProfile {
  decedentFullName: string
  dateOfDeath: string
  county: string
  state: string
  fileNumber?: string
  lettersGrantedDate: string
  firstAdvertisementDate?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  contactAddress?: string
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  rememberDevice: boolean
}

export interface MetadataRecord {
  checklistSeeded: boolean
}

export interface KeyValueRecord<T = unknown> {
  key: string
  value: T
}

export interface BackupPayload {
  version: number
  generatedAt: string
  profile: EstateProfile | null
  settings: AppSettings
  metadata: MetadataRecord
  tasks: Task[]
  assets: AssetRecord[]
  expenses: ExpenseRecord[]
  beneficiaries: BeneficiaryRecord[]
  documents: DocumentRecord[]
}

export interface DeadlineSummary {
  rule105Notice?: string
  certificationOfNotice?: string
  inventoryDue?: string
  inheritanceTaxDue?: string
  inheritanceTaxDiscount?: string
  creditorBarDate?: string
}

export interface CalendarEvent {
  id: string
  title: string
  date: string
  type: 'Task' | 'Deadline'
  status?: TaskStatus
  referenceId?: string
}
