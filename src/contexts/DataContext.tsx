import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { AppData, EstateInfo, Task } from '../types'
import { generateId } from '../utils/id'
import { calculateDeadlines } from '../utils/dates'
import { buildApiUrl, fetchWithRetry } from '../utils/api'
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


type ApiError = Error & { status?: number }

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

const fetchDataFromServer = async (token: string): Promise<AppData> => {
  const response = await fetchWithRetry(buildApiUrl('/api/data'), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  if (response.status === 401) {
    const error = new Error('Unauthorized') as ApiError
    error.status = 401
    throw error
  }
  if (!response.ok) {
    throw new Error(`Failed to load data: ${response.status}`)
  }
  const payload = (await response.json()) as Partial<AppData>
  return normalizeData(payload)
}

const persistDataToServer = async (token: string, data: AppData) => {
  const response = await fetchWithRetry(buildApiUrl('/api/data'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  if (response.status === 401) {
    const error = new Error('Unauthorized') as ApiError
    error.status = 401
    throw error
  }
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

type DataProviderProps = {
  authToken: string
  children: ReactNode
  onUnauthorized: () => void
}

export const DataProvider = ({ authToken, children, onUnauthorized }: DataProviderProps) => {
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
      if (!authToken) {
        setData(defaultData)
        setIsLoaded(true)
        return
      }

      setIsLoaded(false)
      lastSavedSignatureRef.current = null
      saveQueueRef.current = Promise.resolve()

      try {
        const loaded = await fetchDataFromServer(authToken)
        if (cancelled) return
        setData({
          ...loaded,
          tasks: applyAutomaticDueDates(loaded.tasks, loaded.estateInfo)
        })
        setStorageError(null)
      } catch (error) {
        console.error('Failed to load data from server', error)
        const status = (error as ApiError)?.status
        if (status === 401) {
          onUnauthorized()
          return
        }
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
  }, [authToken, onUnauthorized])

  useEffect(() => {
    if (!isLoaded || !authToken) return

    const signature = JSON.stringify(data)
    if (lastSavedSignatureRef.current === signature) {
      return
    }

    const runSave = async () => {
      try {
        await persistDataToServer(authToken, data)
        if (isMountedRef.current) {
          lastSavedSignatureRef.current = signature
          setStorageError(null)
        }
      } catch (error) {
        console.error('Failed to persist data to server', error)
        const status = (error as ApiError)?.status
        if (status === 401) {
          onUnauthorized()
          return
        }
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
  }, [authToken, data, isLoaded, onUnauthorized])

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
