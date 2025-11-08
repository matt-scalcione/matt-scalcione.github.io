import {
  AppData,
  AssetRecord,
  BeneficiaryRecord,
  DocumentRecord,
  EstateInfo,
  ExpenseRecord,
  ManualEvent,
  Task,
  TaskStatus
} from '../types'

export type DataContextValue = {
  data: AppData
  isLoaded: boolean
  storageError: string | null
  dismissStorageError: () => void
  updateEstateInfo: (info: EstateInfo) => void
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTask: (id: string, task: Partial<Task>) => void
  removeTask: (id: string) => void
  changeTaskStatus: (id: string, status: TaskStatus) => void
  replaceTasks: (tasks: Task[]) => void
  markChecklistSeeded: () => void
  addDocument: (doc: Omit<DocumentRecord, 'id' | 'uploadedAt'>) => void
  updateDocument: (id: string, doc: Partial<DocumentRecord>) => void
  removeDocument: (id: string) => void
  addAsset: (asset: Omit<AssetRecord, 'id'>) => void
  updateAsset: (id: string, asset: Partial<AssetRecord>) => void
  removeAsset: (id: string) => void
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => void
  updateExpense: (id: string, expense: Partial<ExpenseRecord>) => void
  removeExpense: (id: string) => void
  addBeneficiary: (beneficiary: Omit<BeneficiaryRecord, 'id'>) => void
  updateBeneficiary: (id: string, beneficiary: Partial<BeneficiaryRecord>) => void
  removeBeneficiary: (id: string) => void
  addEvent: (event: Omit<ManualEvent, 'id'>) => void
  updateEvent: (id: string, event: Partial<ManualEvent>) => void
  removeEvent: (id: string) => void
  restoreData: (data: Partial<AppData>) => void
}
