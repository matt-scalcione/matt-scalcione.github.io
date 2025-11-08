import { ReactNode, createContext, useContext, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ulid } from 'ulidx'
import JSZip from 'jszip'
import {
  AppSettings,
  AssetRecord,
  BackupPayload,
  BeneficiaryRecord,
  CalendarEvent,
  DeadlineSummary,
  DocumentRecord,
  EstateProfile,
  ExpenseRecord,
  MetadataRecord,
  Task,
  TaskStatus
} from '../types'
import { db } from '../db'
import { buildChecklistTasks } from '../data/checklist'
import { buildCalendarEvents, calculateDeadlines } from '../utils/date'

const DEFAULT_SETTINGS: AppSettings = { theme: 'system', rememberDevice: false }
const DEFAULT_METADATA: MetadataRecord = { checklistSeeded: false }

const normalizeProfile = (profile?: EstateProfile | null): EstateProfile | null => {
  if (!profile) return null
  return {
    decedentFullName: profile.decedentFullName ?? '',
    dateOfDeath: profile.dateOfDeath ?? '',
    county: profile.county ?? '',
    state: profile.state ?? '',
    fileNumber: profile.fileNumber ?? '',
    lettersGrantedDate: profile.lettersGrantedDate ?? '',
    firstAdvertisementDate: profile.firstAdvertisementDate ?? '',
    contactName: profile.contactName ?? '',
    contactEmail: profile.contactEmail ?? '',
    contactPhone: profile.contactPhone ?? '',
    contactAddress: profile.contactAddress ?? ''
  }
}

export interface DataContextValue {
  loading: boolean
  tasks: Task[]
  documents: DocumentRecord[]
  assets: AssetRecord[]
  expenses: ExpenseRecord[]
  beneficiaries: BeneficiaryRecord[]
  profile: EstateProfile | null
  settings: AppSettings
  metadata: MetadataRecord
  deadlines: DeadlineSummary
  calendarEvents: CalendarEvent[]
  addTask: (input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateTask: (id: string, updates: Partial<Omit<Task, 'id'>>) => Promise<void>
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>
  removeTask: (id: string) => Promise<void>
  addDocument: (file: File, data: Partial<DocumentRecord>) => Promise<void>
  updateDocument: (id: string, updates: Partial<DocumentRecord>) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  getDocumentBlob: (id: string) => Promise<Blob | null>
  addAsset: (input: Omit<AssetRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateAsset: (id: string, updates: Partial<Omit<AssetRecord, 'id'>>) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  addExpense: (input: Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateExpense: (id: string, updates: Partial<Omit<ExpenseRecord, 'id'>>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
  addBeneficiary: (input: Omit<BeneficiaryRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateBeneficiary: (id: string, updates: Partial<Omit<BeneficiaryRecord, 'id'>>) => Promise<void>
  deleteBeneficiary: (id: string) => Promise<void>
  saveProfile: (profile: EstateProfile) => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  exportBackup: () => Promise<Blob>
  importBackup: (file: File) => Promise<void>
  clearAll: () => Promise<void>
}

const defaultContext: DataContextValue = {
  loading: true,
  tasks: [],
  documents: [],
  assets: [],
  expenses: [],
  beneficiaries: [],
  profile: null,
  settings: DEFAULT_SETTINGS,
  metadata: DEFAULT_METADATA,
  deadlines: {},
  calendarEvents: [],
  addTask: async () => {},
  updateTask: async () => {},
  updateTaskStatus: async () => {},
  removeTask: async () => {},
  addDocument: async () => {},
  updateDocument: async () => {},
  deleteDocument: async () => {},
  getDocumentBlob: async () => null,
  addAsset: async () => {},
  updateAsset: async () => {},
  deleteAsset: async () => {},
  addExpense: async () => {},
  updateExpense: async () => {},
  deleteExpense: async () => {},
  addBeneficiary: async () => {},
  updateBeneficiary: async () => {},
  deleteBeneficiary: async () => {},
  saveProfile: async () => {},
  updateSettings: async () => {},
  exportBackup: async () => new Blob(),
  importBackup: async () => {},
  clearAll: async () => {}
}

const Context = createContext<DataContextValue>(defaultContext)

const ensureChecklistTasks = async (profile: EstateProfile) => {
  const nowIso = new Date().toISOString()
  const templates = buildChecklistTasks(profile, nowIso)
  await db.transaction('rw', db.tasks, db.kv, async () => {
    const metadataRecord = (await db.kv.get('metadata'))?.value as MetadataRecord | undefined
    const seeded = metadataRecord?.checklistSeeded ?? false
    const templateKeys = templates
      .map((template) => template.templateKey)
      .filter((key): key is string => Boolean(key))
    const existing = await db.tasks.where('templateKey').anyOf(templateKeys).toArray()
    const existingByKey = new Map(existing.map((task) => [task.templateKey, task]))

    for (const template of templates) {
      const match = existingByKey.get(template.templateKey)
      if (match) {
        await db.tasks.update(match.id, {
          title: template.title,
          description: template.description,
          category: template.category,
          tags: template.tags,
          dueDate: template.dueDate,
          updatedAt: nowIso
        })
      } else if (!seeded) {
        await db.tasks.add({
          id: ulid(),
          templateKey: template.templateKey,
          title: template.title,
          description: template.description,
          category: template.category,
          tags: template.tags,
          status: template.status,
          dueDate: template.dueDate,
          createdAt: nowIso,
          updatedAt: nowIso
        })
      }
    }

    if (!seeded) {
      await db.kv.put({ key: 'metadata', value: { checklistSeeded: true } })
    }
  })
}

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const tasks = useLiveQuery(() => db.tasks.orderBy('createdAt').toArray(), [], undefined)
  const documents = useLiveQuery(() => db.documents.orderBy('createdAt').reverse().toArray(), [], undefined)
  const assets = useLiveQuery(() => db.assets.orderBy('createdAt').toArray(), [], undefined)
  const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray(), [], undefined)
  const beneficiaries = useLiveQuery(() => db.beneficiaries.orderBy('createdAt').toArray(), [], undefined)
  const profileEntry = useLiveQuery(() => db.kv.get('profile'), [], undefined)
  const settingsEntry = useLiveQuery(() => db.kv.get('settings'), [], undefined)
  const metadataEntry = useLiveQuery(() => db.kv.get('metadata'), [], undefined)

  const profile = useMemo(() => normalizeProfile(profileEntry?.value as EstateProfile | null), [profileEntry])
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(settingsEntry?.value as AppSettings | undefined) }), [settingsEntry])
  const metadata = useMemo(() => ({ ...DEFAULT_METADATA, ...(metadataEntry?.value as MetadataRecord | undefined) }), [metadataEntry])
  const deadlines = useMemo(() => calculateDeadlines(profile ?? undefined), [profile])
  const calendarEvents = useMemo(
    () => buildCalendarEvents(tasks ?? [], deadlines),
    [tasks, deadlines]
  )

  const loading =
    tasks === undefined ||
    documents === undefined ||
    assets === undefined ||
    expenses === undefined ||
    beneficiaries === undefined ||
    profileEntry === undefined ||
    settingsEntry === undefined ||
    metadataEntry === undefined

  const addTask: DataContextValue['addTask'] = async (input) => {
    const nowIso = new Date().toISOString()
    await db.tasks.add({
      ...input,
      id: ulid(),
      createdAt: nowIso,
      updatedAt: nowIso
    })
  }

  const updateTask: DataContextValue['updateTask'] = async (id, updates) => {
    await db.tasks.update(id, { ...updates, updatedAt: new Date().toISOString() })
  }

  const updateTaskStatus: DataContextValue['updateTaskStatus'] = async (id, status) => {
    await db.tasks.update(id, { status, updatedAt: new Date().toISOString() })
  }

  const removeTask: DataContextValue['removeTask'] = async (id) => {
    await db.tasks.delete(id)
  }

  const addDocument: DataContextValue['addDocument'] = async (file, data) => {
    const id = ulid()
    const nowIso = new Date().toISOString()
    await db.transaction('rw', db.documents, db.documentBlobs, async () => {
      await db.documentBlobs.put({ id, blob: file })
      await db.documents.put({
        id,
        blobRef: id,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        title: data.title,
        notes: data.notes,
        tags: data.tags ?? [],
        createdAt: nowIso
      })
    })
  }

  const updateDocument: DataContextValue['updateDocument'] = async (id, updates) => {
    await db.documents.update(id, { ...updates, updatedAt: new Date().toISOString() })
  }

  const deleteDocument: DataContextValue['deleteDocument'] = async (id) => {
    await db.transaction('rw', db.documents, db.documentBlobs, async () => {
      await db.documents.delete(id)
      await db.documentBlobs.delete(id)
    })
  }

  const getDocumentBlob: DataContextValue['getDocumentBlob'] = async (id) => {
    const record = await db.documentBlobs.get(id)
    return record?.blob ?? null
  }

  const addAsset: DataContextValue['addAsset'] = async (input) => {
    const nowIso = new Date().toISOString()
    await db.assets.add({
      ...input,
      id: ulid(),
      createdAt: nowIso,
      updatedAt: nowIso
    })
  }

  const updateAsset: DataContextValue['updateAsset'] = async (id, updates) => {
    await db.assets.update(id, { ...updates, updatedAt: new Date().toISOString() })
  }

  const deleteAsset: DataContextValue['deleteAsset'] = async (id) => {
    await db.assets.delete(id)
  }

  const addExpense: DataContextValue['addExpense'] = async (input) => {
    const nowIso = new Date().toISOString()
    await db.expenses.add({
      ...input,
      id: ulid(),
      createdAt: nowIso,
      updatedAt: nowIso
    })
  }

  const updateExpense: DataContextValue['updateExpense'] = async (id, updates) => {
    await db.expenses.update(id, { ...updates, updatedAt: new Date().toISOString() })
  }

  const deleteExpense: DataContextValue['deleteExpense'] = async (id) => {
    await db.expenses.delete(id)
  }

  const addBeneficiary: DataContextValue['addBeneficiary'] = async (input) => {
    const nowIso = new Date().toISOString()
    await db.beneficiaries.add({
      ...input,
      id: ulid(),
      createdAt: nowIso,
      updatedAt: nowIso
    })
  }

  const updateBeneficiary: DataContextValue['updateBeneficiary'] = async (id, updates) => {
    await db.beneficiaries.update(id, { ...updates, updatedAt: new Date().toISOString() })
  }

  const deleteBeneficiary: DataContextValue['deleteBeneficiary'] = async (id) => {
    await db.beneficiaries.delete(id)
  }

  const saveProfile: DataContextValue['saveProfile'] = async (nextProfile) => {
    await db.kv.put({ key: 'profile', value: nextProfile })
    await ensureChecklistTasks(nextProfile)
  }

  const updateSettings: DataContextValue['updateSettings'] = async (updates) => {
    await db.kv.put({ key: 'settings', value: { ...settings, ...updates } })
  }

  const exportBackup: DataContextValue['exportBackup'] = async () => {
    const [taskRows, assetRows, expenseRows, beneficiaryRows, documentRows, metadataRow, settingsRow, profileRow] =
      await Promise.all([
        db.tasks.toArray(),
        db.assets.toArray(),
        db.expenses.toArray(),
        db.beneficiaries.toArray(),
        db.documents.toArray(),
        db.kv.get('metadata'),
        db.kv.get('settings'),
        db.kv.get('profile')
      ])

    const payload: BackupPayload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      profile: normalizeProfile(profileRow?.value as EstateProfile | null),
      settings: { ...DEFAULT_SETTINGS, ...(settingsRow?.value as AppSettings | undefined) },
      metadata: { ...DEFAULT_METADATA, ...(metadataRow?.value as MetadataRecord | undefined) },
      tasks: taskRows,
      assets: assetRows,
      expenses: expenseRows,
      beneficiaries: beneficiaryRows,
      documents: documentRows
    }

    const zip = new JSZip()
    zip.file('data.json', JSON.stringify(payload, null, 2))
    const docsFolder = zip.folder('documents')
    if (docsFolder) {
      for (const doc of documentRows) {
        const blobRecord = await db.documentBlobs.get(doc.blobRef)
        if (blobRecord?.blob) {
          docsFolder.file(`${doc.id}-${doc.filename}`, blobRecord.blob)
        }
      }
    }

    return zip.generateAsync({ type: 'blob' })
  }

  const importBackup: DataContextValue['importBackup'] = async (file) => {
    const zip = await JSZip.loadAsync(file)
    const dataFile = zip.file('data.json')
    if (!dataFile) {
      throw new Error('Backup archive is missing data.json')
    }
    const jsonText = await dataFile.async('string')
    const payload = JSON.parse(jsonText) as BackupPayload

    await db.transaction('rw', [db.tasks, db.documents, db.documentBlobs, db.assets, db.expenses, db.beneficiaries, db.kv], async () => {
      await Promise.all([
        db.tasks.clear(),
        db.documents.clear(),
        db.documentBlobs.clear(),
        db.assets.clear(),
        db.expenses.clear(),
        db.beneficiaries.clear()
      ])

      if (payload.tasks?.length) {
        await db.tasks.bulkAdd(payload.tasks)
      }
      if (payload.documents?.length) {
        await db.documents.bulkAdd(payload.documents)
        for (const doc of payload.documents) {
          const fileEntry = zip.file(`documents/${doc.id}-${doc.filename}`)
          if (fileEntry) {
            const blob = await fileEntry.async('blob')
            await db.documentBlobs.put({ id: doc.blobRef, blob })
          }
        }
      }
      if (payload.assets?.length) {
        await db.assets.bulkAdd(payload.assets)
      }
      if (payload.expenses?.length) {
        await db.expenses.bulkAdd(payload.expenses)
      }
      if (payload.beneficiaries?.length) {
        await db.beneficiaries.bulkAdd(payload.beneficiaries)
      }
      if (payload.profile) {
        await db.kv.put({ key: 'profile', value: payload.profile })
      }
      await db.kv.put({ key: 'settings', value: payload.settings ?? DEFAULT_SETTINGS })
      await db.kv.put({ key: 'metadata', value: payload.metadata ?? DEFAULT_METADATA })
    })
  }

  const clearAll: DataContextValue['clearAll'] = async () => {
    await db.transaction('rw', [db.tasks, db.documents, db.documentBlobs, db.assets, db.expenses, db.beneficiaries, db.kv], async () => {
      await Promise.all([
        db.tasks.clear(),
        db.documents.clear(),
        db.documentBlobs.clear(),
        db.assets.clear(),
        db.expenses.clear(),
        db.beneficiaries.clear(),
        db.kv.clear()
      ])
    })
  }

  const value = useMemo<DataContextValue>(() => ({
    loading,
    tasks: tasks ?? [],
    documents: documents ?? [],
    assets: assets ?? [],
    expenses: expenses ?? [],
    beneficiaries: beneficiaries ?? [],
    profile,
    settings,
    metadata,
    deadlines,
    calendarEvents,
    addTask,
    updateTask,
    updateTaskStatus,
    removeTask,
    addDocument,
    updateDocument,
    deleteDocument,
    getDocumentBlob,
    addAsset,
    updateAsset,
    deleteAsset,
    addExpense,
    updateExpense,
    deleteExpense,
    addBeneficiary,
    updateBeneficiary,
    deleteBeneficiary,
    saveProfile,
    updateSettings,
    exportBackup,
    importBackup,
    clearAll
  }), [
    loading,
    tasks,
    documents,
    assets,
    expenses,
    beneficiaries,
    profile,
    settings,
    metadata,
    deadlines,
    calendarEvents
  ])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useDataContext = () => useContext(Context)
