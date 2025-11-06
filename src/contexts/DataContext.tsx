import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
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
import { STORAGE_KEY } from '../utils/constants'
import { calculateDeadlines } from '../utils/dates'

const defaultData: AppData = {
  tasks: [],
  documents: [],
  assets: [],
  expenses: [],
  beneficiaries: [],
  manualEvents: [],
  estateInfo: {}
}

type DataContextValue = {
  data: AppData
  updateEstateInfo: (info: EstateInfo) => void
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTask: (id: string, task: Partial<Task>) => void
  removeTask: (id: string) => void
  changeTaskStatus: (id: string, status: TaskStatus) => void
  replaceTasks: (tasks: Task[]) => void
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
  restoreData: (data: AppData) => void
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

const persistData = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const loadData = (): AppData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData
    const parsed = JSON.parse(raw) as AppData
    return {
      ...defaultData,
      ...parsed,
      tasks: parsed.tasks ?? [],
      documents: parsed.documents ?? [],
      assets: parsed.assets ?? [],
      expenses: parsed.expenses ?? [],
      beneficiaries: parsed.beneficiaries ?? [],
      manualEvents: parsed.manualEvents ?? [],
      estateInfo: parsed.estateInfo ?? {}
    }
  } catch (error) {
    console.error('Failed to load data from storage', error)
    return defaultData
  }
}

const applyAutomaticDueDates = (tasks: Task[], estateInfo: EstateInfo): Task[] => {
  const deadlines = calculateDeadlines(estateInfo)
  return tasks.map((task) =>
    task.autoSchedule && deadlines[task.autoSchedule]
      ? {
          ...task,
          dueDate: deadlines[task.autoSchedule]
        }
      : task
  )
}

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<AppData>(() => {
    const loaded = loadData()
    return {
      ...loaded,
      tasks: applyAutomaticDueDates(loaded.tasks, loaded.estateInfo)
    }
  })

  useEffect(() => {
    persistData(data)
  }, [data])

  const value = useMemo<DataContextValue>(() => ({
    data,
    updateEstateInfo: (info) => {
      setData((prev) => {
        const estateInfo = { ...prev.estateInfo, ...info }
        return {
          ...prev,
          estateInfo,
          tasks: applyAutomaticDueDates(prev.tasks, estateInfo)
        }
      })
    },
    addTask: (task) => {
      setData((prev) => {
        const newTask: Task = {
          ...task,
          id: crypto.randomUUID(),
          createdAt: dayjs().toISOString(),
          updatedAt: dayjs().toISOString()
        }
        const tasks = applyAutomaticDueDates([...prev.tasks, newTask], prev.estateInfo)
        return { ...prev, tasks }
      })
    },
    updateTask: (id, updated) => {
      setData((prev) => {
        const tasks = prev.tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                ...updated,
                updatedAt: dayjs().toISOString()
              }
            : task
        )
        return { ...prev, tasks: applyAutomaticDueDates(tasks, prev.estateInfo) }
      })
    },
    removeTask: (id) => {
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((task) => task.id !== id)
      }))
    },
    changeTaskStatus: (id, status) => {
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                status,
                updatedAt: dayjs().toISOString()
              }
            : task
        )
      }))
    },
    replaceTasks: (tasks) => {
      setData((prev) => ({
        ...prev,
        tasks: applyAutomaticDueDates(tasks, prev.estateInfo)
      }))
    },
    addDocument: (doc) => {
      setData((prev) => ({
        ...prev,
        documents: [
          ...prev.documents,
          {
            ...doc,
            id: crypto.randomUUID(),
            uploadedAt: dayjs().toISOString()
          }
        ]
      }))
    },
    updateDocument: (id, doc) => {
      setData((prev) => ({
        ...prev,
        documents: prev.documents.map((item) => (item.id === id ? { ...item, ...doc } : item))
      }))
    },
    removeDocument: (id) => {
      setData((prev) => ({
        ...prev,
        documents: prev.documents.filter((doc) => doc.id !== id),
        assets: prev.assets.map((asset) => ({
          ...asset,
          attachedDocumentIds: asset.attachedDocumentIds.filter((docId) => docId !== id)
        })),
        expenses: prev.expenses.map((expense) => ({
          ...expense,
          receiptId: expense.receiptId === id ? undefined : expense.receiptId
        }))
      }))
    },
    addAsset: (asset) => {
      setData((prev) => ({
        ...prev,
        assets: [...prev.assets, { ...asset, id: crypto.randomUUID() }]
      }))
    },
    updateAsset: (id, asset) => {
      setData((prev) => ({
        ...prev,
        assets: prev.assets.map((item) => (item.id === id ? { ...item, ...asset } : item))
      }))
    },
    removeAsset: (id) => {
      setData((prev) => ({
        ...prev,
        assets: prev.assets.filter((asset) => asset.id !== id)
      }))
    },
    addExpense: (expense) => {
      setData((prev) => ({
        ...prev,
        expenses: [...prev.expenses, { ...expense, id: crypto.randomUUID() }]
      }))
    },
    updateExpense: (id, expense) => {
      setData((prev) => ({
        ...prev,
        expenses: prev.expenses.map((item) => (item.id === id ? { ...item, ...expense } : item))
      }))
    },
    removeExpense: (id) => {
      setData((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((expense) => expense.id !== id)
      }))
    },
    addBeneficiary: (beneficiary) => {
      setData((prev) => ({
        ...prev,
        beneficiaries: [...prev.beneficiaries, { ...beneficiary, id: crypto.randomUUID() }]
      }))
    },
    updateBeneficiary: (id, beneficiary) => {
      setData((prev) => ({
        ...prev,
        beneficiaries: prev.beneficiaries.map((item) =>
          item.id === id ? { ...item, ...beneficiary } : item
        )
      }))
    },
    removeBeneficiary: (id) => {
      setData((prev) => ({
        ...prev,
        beneficiaries: prev.beneficiaries.filter((beneficiary) => beneficiary.id !== id)
      }))
    },
    addEvent: (event) => {
      setData((prev) => ({
        ...prev,
        manualEvents: [...prev.manualEvents, { ...event, id: crypto.randomUUID() }]
      }))
    },
    updateEvent: (id, event) => {
      setData((prev) => ({
        ...prev,
        manualEvents: prev.manualEvents.map((item) => (item.id === id ? { ...item, ...event } : item))
      }))
    },
    removeEvent: (id) => {
      setData((prev) => ({
        ...prev,
        manualEvents: prev.manualEvents.filter((event) => event.id !== id)
      }))
    },
    restoreData: (incoming) => {
      setData(() => ({
        ...defaultData,
        ...incoming,
        tasks: applyAutomaticDueDates(incoming.tasks ?? [], incoming.estateInfo ?? {}),
        documents: incoming.documents ?? [],
        assets: incoming.assets ?? [],
        expenses: incoming.expenses ?? [],
        beneficiaries: incoming.beneficiaries ?? [],
        manualEvents: incoming.manualEvents ?? [],
        estateInfo: incoming.estateInfo ?? {}
      }))
    }
  }), [data])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useDataContext = () => {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useDataContext must be used within DataProvider')
  }
  return context
}
