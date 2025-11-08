import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { AppData, EstateInfo, Task } from '../types'
import { generateId } from '../utils/id'
import { calculateDeadlines } from '../utils/dates'
import { DataContext } from './DataContextBase'
import type { DataContextValue } from './DataContext.types'

const defaultData: AppData = {
  tasks: [],
  documents: [],
  assets: [],
  expenses: [],
  beneficiaries: [],
  manualEvents: [],
  estateInfo: {},
  metadata: {
    checklistSeeded: false
  }
}


type RuntimeConfig = {
  apiBaseUrl?: string
}

const resolveRuntimeConfig = (): RuntimeConfig => {
  if (typeof window === 'undefined') {
    return {}
  }

  const config = (window as typeof window & { __APP_CONFIG__?: RuntimeConfig }).__APP_CONFIG__
  if (config && typeof config === 'object') {
    return config
  }

  return {}
}

const resolveApiBaseUrl = () => {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env
  const value = env?.VITE_API_BASE_URL
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  const runtime = resolveRuntimeConfig()
  if (runtime.apiBaseUrl && runtime.apiBaseUrl.trim().length > 0) {
    return runtime.apiBaseUrl.trim()
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001'
    }
  }

  return ''
}

const API_BASE_URL = resolveApiBaseUrl()

const normalizeData = (raw?: Partial<AppData>): AppData => {
  const base = raw ?? {}
  return {
    ...defaultData,
    ...base,
    tasks: base.tasks ?? [],
    documents: base.documents ?? [],
    assets: base.assets ?? [],
    expenses: base.expenses ?? [],
    beneficiaries: base.beneficiaries ?? [],
    manualEvents: base.manualEvents ?? [],
    estateInfo: base.estateInfo ?? {},
    metadata: {
      ...defaultData.metadata,
      ...(base.metadata ?? {})
    }
  }
}

const fetchDataFromServer = async (): Promise<AppData> => {
  const response = await fetch(`${API_BASE_URL}/api/data`)
  if (!response.ok) {
    throw new Error(`Failed to load data: ${response.status}`)
  }
  const payload = (await response.json()) as Partial<AppData>
  return normalizeData(payload)
}

const persistDataToServer = async (data: AppData) => {
  const response = await fetch(`${API_BASE_URL}/api/data`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    throw new Error(`Failed to save data: ${response.status}`)
  }
  const saved = (await response.json()) as Partial<AppData>
  return normalizeData(saved)
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
  const [data, setData] = useState<AppData>(defaultData)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const lastSavedSignatureRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const loaded = await fetchDataFromServer()
        if (cancelled) return
        setData({
          ...loaded,
          tasks: applyAutomaticDueDates(loaded.tasks, loaded.estateInfo)
        })
        setStorageError(null)
      } catch (error) {
        console.error('Failed to load data from server', error)
        if (!cancelled) {
          setStorageError('Unable to load saved data from the server. Starting with a blank workspace.')
          setData(defaultData)
        }
      } finally {
        if (!cancelled) {
          setIsLoaded(true)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    const signature = JSON.stringify(data)
    if (lastSavedSignatureRef.current === signature) {
      return
    }

    const runSave = async () => {
      try {
        await persistDataToServer(data)
        if (isMountedRef.current) {
          lastSavedSignatureRef.current = signature
          setStorageError(null)
        }
      } catch (error) {
        console.error('Failed to persist data to server', error)
        if (isMountedRef.current) {
          setStorageError('Failed to save your latest changes to the server. Please try again.')
        }
      }
    }

    saveQueueRef.current = saveQueueRef.current
      .catch((error) => {
        console.error('Previous save request failed', error)
      })
      .then(() => runSave())
  }, [data, isLoaded])

  const value = useMemo<DataContextValue>(() => ({
    data,
    isLoaded,
    storageError,
    dismissStorageError: () => setStorageError(null),
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
          id: generateId(),
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
    markChecklistSeeded: () => {
      setData((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          checklistSeeded: true
        }
      }))
    },
    addDocument: (doc) => {
      setData((prev) => ({
        ...prev,
        documents: [
          ...prev.documents,
          {
            ...doc,
            id: generateId(),
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
        assets: [...prev.assets, { ...asset, id: generateId() }]
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
        expenses: [...prev.expenses, { ...expense, id: generateId() }]
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
        beneficiaries: [...prev.beneficiaries, { ...beneficiary, id: generateId() }]
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
        manualEvents: [...prev.manualEvents, { ...event, id: generateId() }]
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
      const normalized = normalizeData(incoming)
      setData({
        ...normalized,
        tasks: applyAutomaticDueDates(normalized.tasks, normalized.estateInfo)
      })
    }
  }), [data, isLoaded, storageError])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
