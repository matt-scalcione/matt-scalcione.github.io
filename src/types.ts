export type TaskStatus = 'todo' | 'inProgress' | 'completed'

export interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string
  category?: string
  tags: string[]
  status: TaskStatus
  assignedTo?: string
  createdAt: string
  updatedAt: string
  autoSchedule?: AutoScheduleKey
}

export type AutoScheduleKey =
  | 'heirNotice'
  | 'inventoryDue'
  | 'inheritanceTax'
  | 'inheritanceTaxDiscount'
  | 'creditorBar'

export interface DocumentRecord {
  id: string
  title: string
  description?: string
  tags: string[]
  category?: string
  notes?: string
  uploadedAt: string
  fileName: string
  fileType: string
  dataUrl: string
}

export interface AssetRecord {
  id: string
  name: string
  category: string
  ownerStatus: string
  probateStatus: 'probate' | 'non-probate'
  taxable: boolean
  value?: number
  notes?: string
  attachedDocumentIds: string[]
  disposition?: {
    status: 'held' | 'sold' | 'distributed'
    date?: string
    details?: string
  }
}

export interface ExpenseRecord {
  id: string
  date: string
  payee: string
  description: string
  amount: number
  category: string
  paidFromEstate: boolean
  reimbursed: boolean
  reimbursementDate?: string
  notes?: string
  receiptId?: string
}

export interface BeneficiaryRecord {
  id: string
  name: string
  relation?: string
  email?: string
  phone?: string
  address?: string
  share?: string
  notes?: string
  noticeSentDate?: string
}

export interface ManualEvent {
  id: string
  title: string
  description?: string
  date: string
  relatedTaskId?: string
  category?: string
}

export interface EstateInfo {
  estateName?: string
  decedentName?: string
  docketNumber?: string
  county?: string
  dateOfDeath?: string
  lettersGrantedDate?: string
  firstAdvertisementDate?: string
  attorneyName?: string
  notes?: string
}

export interface AppData {
  tasks: Task[]
  documents: DocumentRecord[]
  assets: AssetRecord[]
  expenses: ExpenseRecord[]
  beneficiaries: BeneficiaryRecord[]
  manualEvents: ManualEvent[]
  estateInfo: EstateInfo
}
